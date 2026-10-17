"""Общие инструменты запуска. Точки входа: START.cmd, frontend/start.cmd, backend/start.cmd."""
import argparse
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
VENV = BACKEND / ".venv"
PYTHON = VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def setup(force=False):
    if not PYTHON.exists():
        print("Первый запуск: создаю окружение Python...", flush=True)
        subprocess.run([sys.executable, "-m", "venv", str(VENV)], check=True)
    check = subprocess.run([str(PYTHON), "-c", "import fastapi, uvicorn, sqlalchemy, pydantic, psycopg, email_validator"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if force or check.returncode:
        print("Устанавливаю зависимости. При первом запуске нужен интернет...", flush=True)
        requirements = "requirements-dev.txt" if force else "requirements.txt"
        subprocess.run([str(PYTHON), "-m", "pip", "install", "-r", str(BACKEND / requirements)], check=True)
    if not (BACKEND / ".env").exists():
        shutil.copyfile(BACKEND / ".env.example", BACKEND / ".env")


def check_port(port):
    with socket.socket() as probe:
        if os.name == "nt":
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        try:
            probe.bind(("127.0.0.1", port))
        except OSError:
            raise RuntimeError(f"Порт {port} занят. Остановите ранее запущенный сервер (Ctrl+C в его окне).") from None


def stop(process):
    if process.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()


def wait_ready(url, processes):
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if any(process.poll() is not None for process in processes):
            raise RuntimeError("Сервер завершился при запуске. Причина указана выше.")
        try:
            with urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except (OSError, URLError):
            pass
        time.sleep(0.2)
    raise RuntimeError(f"Сервер не готов за 30 секунд: {url}. Проверьте сообщения выше.")


def source_snapshot(directory):
    result = {}
    for path in directory.rglob("*.py"):
        try:
            result[path] = path.stat().st_mtime_ns
        except FileNotFoundError:
            pass
    return result


def run(target, backend_port=8000, frontend_port=5500):
    backend = target in ("backend", "all")
    frontend = target in ("frontend", "all")
    if backend:
        check_port(backend_port)
    if frontend:
        check_port(frontend_port)
    if backend:
        setup()
    print("\nЗапускаю серверы...", flush=True)
    processes = []
    process_options = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == "nt" else {}

    def start_backend():
        env = {**os.environ, "SERVE_FRONTEND": "false", "PYTHONUTF8": "1"}
        # Собственное наблюдение за файлами: reloader Uvicorn на Windows рассылает
        # CTRL_C_EVENT по консоли и способен остановить родительский launcher.
        return subprocess.Popen([str(PYTHON), "-m", "uvicorn", "app.main:app",
                                 "--host", "127.0.0.1", "--port", str(backend_port)],
                                cwd=BACKEND, env=env, **process_options)

    try:
        if backend:
            sources = source_snapshot(BACKEND / "app")
            processes.append(start_backend())
        if frontend:
            python = str(PYTHON) if PYTHON.exists() else sys.executable
            processes.append(subprocess.Popen([python, "-u", str(ROOT / "scripts/dev/frontend_server.py"),
                                               "--port", str(frontend_port), "--backend-port", str(backend_port)],
                                              cwd=ROOT, env={**os.environ, "PYTHONUTF8": "1"}, **process_options))
        if backend:
            wait_ready(f"http://127.0.0.1:{backend_port}/api/health", processes)
        if frontend:
            wait_ready(f"http://127.0.0.1:{frontend_port}/", processes)
        print("\nГОТОВО. Оставьте окно открытым. Остановка — Ctrl+C.", flush=True)
        if frontend:
            print(f"САЙТ: http://localhost:{frontend_port}", flush=True)
        if backend:
            print(f"API: http://localhost:{backend_port}/docs", flush=True)
        elif frontend:
            print(f"Для загрузки данных запустите backend/start.cmd (порт API: {backend_port}).", flush=True)
        while all(process.poll() is None for process in processes):
            time.sleep(0.3)
            if backend:
                current = source_snapshot(BACKEND / "app")
                if current != sources:
                    print("\nPython-файлы изменены. Перезапускаю только бэкенд...", flush=True)
                    stop(processes[0])
                    processes[0] = start_backend()
                    sources = current
                    wait_ready(f"http://127.0.0.1:{backend_port}/api/health", processes)
                    print("Бэкенд снова готов.", flush=True)
        for process in processes:
            if process.poll() not in (None, 0):
                raise RuntimeError("Сервер завершился с ошибкой. Причина указана выше в этом окне.")
    except KeyboardInterrupt:
        print("\nОстанавливаю серверы...", flush=True)
        # На Windows дочерние процессы изолированы от сигналов общей консоли.
        for process in processes:
            try:
                process.wait(timeout=0.2 if os.name == "nt" else 3)
            except subprocess.TimeoutExpired:
                pass
    finally:
        for process in processes:
            stop(process)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", nargs="?", default="all", choices=["all", "frontend", "backend", "setup"])
    parser.add_argument("--backend-port", type=int, default=8000, help="Порт API (по умолчанию 8000)")
    parser.add_argument("--frontend-port", type=int, default=5500, help="Порт сайта (по умолчанию 5500)")
    args = parser.parse_args()
    if not all(1 <= port <= 65535 for port in (args.backend_port, args.frontend_port)):
        parser.error("Номер порта должен быть от 1 до 65535")
    if args.backend_port == args.frontend_port:
        parser.error("Для фронтенда и бэкенда нужны разные порты")
    target = args.target
    if sys.version_info < (3, 11):
        raise RuntimeError("Установите Python 3.11 или новее: https://www.python.org/downloads/")
    if target == "setup":
        setup(force=True)
        print("\nГотово! Откройте START.cmd для запуска сайта.")
    else:
        run(target, args.backend_port, args.frontend_port)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, subprocess.CalledProcessError) as exc:
        print(f"\nОшибка запуска: {exc}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nЗапуск отменён.")

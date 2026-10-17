"""Проверяем реальные точки входа из папок frontend, backend и корня."""
import json
import os
from pathlib import Path
import socket
import subprocess
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import pytest

ROOT = Path(__file__).resolve().parents[2]


def free_port():
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def request(url, data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = Request(url, data=json.dumps(data).encode() if data else None, headers=headers)
    try:
        with urlopen(req, timeout=2) as response:
            return response.status, response.read()
    except HTTPError as exc:
        return exc.code, exc.read()


@pytest.mark.skipif(os.name != "nt", reason="Windows .cmd entry points")
@pytest.mark.parametrize("mode", ["separate", "all", "reload"])
def test_entry_points_from_their_own_folders(mode, tmp_path):
    backend_port, frontend_port = free_port(), free_port()
    while frontend_port == backend_port:
        frontend_port = free_port()
    env = {**os.environ, "PYTHONUTF8": "1", "ENV": "development",
           "DATABASE_URL": f"sqlite:///{(tmp_path / 'launch.db').as_posix()}",
           "INIT_DB_ON_STARTUP": "true", "SEED_DEMO_DATA": "true"}
    ports = ["--backend-port", str(backend_port), "--frontend-port", str(frontend_port)]
    commands = [(ROOT, "START.cmd")] if mode in ("all", "reload") else [
        (ROOT / "backend", "start.cmd"), (ROOT / "frontend", "start.cmd")]
    processes = []
    with (tmp_path / "servers.log").open("w+b") as log:
        try:
            for cwd, entry in commands:
                processes.append(subprocess.Popen(["cmd", "/d", "/c", entry, *ports], cwd=cwd,
                    env=env, stdin=subprocess.DEVNULL, stdout=log, stderr=log))
            api = f"http://127.0.0.1:{backend_port}"
            site = f"http://127.0.0.1:{frontend_port}"
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                try:
                    if request(site + "/api/health")[0] == 200:
                        break
                except (OSError, URLError):
                    pass
                if any(p.poll() is not None for p in processes):
                    break
                time.sleep(0.2)
            assert request(site + "/api/health")[0] == 200
            assert request(site + "/")[0] == 200
            assert request(site + "/pages/login.html")[0] == 200
            assert request(api + "/docs")[0] == 200
            assert request(api + "/")[0] == 404
            status, body = request(site + "/api/auth/login", {"email": "demo@barber.kz", "password": "demo123"})
            assert status == 200, body
            token = json.loads(body)["token"]
            assert request(site + "/api/auth/me", token=token)[0] == 200
            assert request(site + "/api/auth/me", token="invalid")[0] == 401
            if mode == 'reload':
                # Только метаданные: содержимое исходника не меняется, время восстанавливаем.
                source = ROOT / 'backend/app/__init__.py'
                previous = source.stat()
                try:
                    os.utime(source, ns=(previous.st_atime_ns, max(time.time_ns(), previous.st_mtime_ns + 10_000_000)))
                    deadline = time.monotonic() + 25
                    while time.monotonic() < deadline:
                        text = (tmp_path / 'servers.log').read_text(encoding='utf-8', errors='replace')
                        if 'Бэкенд снова готов.' in text:
                            break
                        assert all(p.poll() is None for p in processes)
                        time.sleep(0.2)
                    else:
                        pytest.fail('API не перезапустился после изменения Python-файла')
                    assert request(site + '/')[0] == 200
                    assert request(site + '/api/auth/me', token=token)[0] == 200
                finally:
                    os.utime(source, ns=(previous.st_atime_ns, previous.st_mtime_ns))
        except Exception:
            log.seek(0)
            print(log.read().decode("utf-8", errors="replace"))
            raise
        finally:
            for process in processes:
                if process.poll() is None:
                    subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                process.wait(timeout=10)

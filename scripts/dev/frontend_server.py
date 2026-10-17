"""Локальный сервер фронтенда: статика на 5500, /api -> бэкенд на 8000.

Только стандартная библиотека Python; Node.js и настройка CORS не нужны.
"""
import argparse
import json
from functools import partial
from http.client import HTTPConnection
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

FRONTEND = Path(__file__).resolve().parents[2] / "frontend"
HOP_HEADERS = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailer", "transfer-encoding", "upgrade", "host", "content-length",
}


class FrontendHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".css": "text/css"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_error(self, code, message=None, explain=None):
        page = FRONTEND / "404.html"
        if code == 404 and page.is_file():
            data = page.read_bytes()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(data)
            return
        super().send_error(code, message, explain)

    def _handle(self):
        path = urlsplit(self.path).path
        if path == "/api" or path.startswith("/api/"):
            self._proxy()
        elif self.command == "GET":
            super().do_GET()
        elif self.command == "HEAD":
            super().do_HEAD()
        else:
            self.send_error(405, "Method not allowed for static files")

    def _proxy(self):
        connection = HTTPConnection("127.0.0.1", self.server.backend_port, timeout=30)
        try:
            body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
            headers = {k: v for k, v in self.headers.items() if k.lower() not in HOP_HEADERS}
            # Отправляем только путь на фиксированный локальный бэкенд.
            target = urlsplit(self.path)
            path = target.path + ("?" + target.query if target.query else "")
            connection.request(self.command, path, body=body, headers=headers)
            response = connection.getresponse()
            data = response.read()
            self.send_response(response.status)
            for key, value in response.getheaders():
                if key.lower() not in HOP_HEADERS and key.lower() != "cache-control":
                    self.send_header(key, value)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(data)
        except (OSError, ValueError) as exc:
            self.log_error("Backend unavailable: %s", exc)
            data = json.dumps({"detail": "Бэкенд недоступен. Запустите backend/start.cmd и дождитесь готовности сервера."}, ensure_ascii=False).encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(data)
        finally:
            connection.close()

    do_GET = do_HEAD = do_POST = do_PATCH = do_PUT = do_DELETE = do_OPTIONS = _handle


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=5500)
    parser.add_argument("--backend-port", type=int, default=8000)
    args = parser.parse_args()
    handler = partial(FrontendHandler, directory=str(FRONTEND))
    with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        server.backend_port = args.backend_port
        print(f"Фронтенд: http://localhost:{args.port} | API: http://127.0.0.1:{args.backend_port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()

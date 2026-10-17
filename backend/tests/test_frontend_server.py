"""Проверяем HTTP-контракт отдельного сервера фронтенда без рабочей базы."""
import importlib.util
import json
import threading
from functools import partial
from http.client import HTTPConnection
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

_spec = importlib.util.spec_from_file_location(
    "frontend_server", Path(__file__).resolve().parents[2] / "scripts/dev/frontend_server.py")
frontend_server = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(frontend_server)


class EchoAPI(BaseHTTPRequestHandler):
    def do_PATCH(self):
        data = json.dumps({
            "path": self.path,
            "authorization": self.headers.get("Authorization"),
            "body": json.loads(self.rfile.read(int(self.headers["Content-Length"]))),
        }).encode()
        self.send_response(422)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


@pytest.fixture
def servers():
    api = ThreadingHTTPServer(("127.0.0.1", 0), EchoAPI)
    frontend = ThreadingHTTPServer(("127.0.0.1", 0), partial(
        frontend_server.FrontendHandler, directory=str(frontend_server.FRONTEND)))
    frontend.backend_port = api.server_port
    threads = [threading.Thread(target=s.serve_forever, daemon=True) for s in (api, frontend)]
    for thread in threads:
        thread.start()
    try:
        yield api, frontend
    finally:
        for server in (api, frontend):
            server.shutdown()
            server.server_close()
        for thread in threads:
            thread.join(timeout=3)


def request(server, method, path, body=None, headers=None):
    connection = HTTPConnection("127.0.0.1", server.server_port, timeout=5)
    try:
        connection.request(method, path, body=body, headers=headers or {})
        response = connection.getresponse()
        return response.status, {key.lower(): value for key, value in response.getheaders()}, response.read()
    finally:
        connection.close()


def test_proxy_preserves_body_auth_query_and_error_status(servers):
    _, frontend = servers
    status, headers, body = request(frontend, "PATCH", "/api/me/profile?q=a%20b",
                                    json.dumps({"name": "Димаш"}),
                                    {"Authorization": "Bearer test-token", "Content-Type": "application/json"})
    assert status == 422
    assert headers["content-type"] == "application/json"
    assert json.loads(body) == {"path": "/api/me/profile?q=a%20b",
                                "authorization": "Bearer test-token", "body": {"name": "Димаш"}}


def test_static_files_work_without_backend_and_report_api_error(servers):
    api, frontend = servers
    api.shutdown()
    api.server_close()
    status, _, body = request(frontend, "GET", "/")
    assert status == 200
    assert b"<!doctype html" in body.lower()
    status, _, body = request(frontend, "GET", "/api/stats")
    assert status == 502
    assert "backend/start.cmd" in json.loads(body)["detail"]


def test_javascript_mime_head_and_static_methods(servers):
    _, frontend = servers
    status, headers, body = request(frontend, "GET", "/assets/js/core/api.js")
    assert status == 200
    assert headers["content-type"] == "text/javascript"
    assert headers["cache-control"] == "no-cache"
    assert b"export" in body
    status, headers, body = request(frontend, "HEAD", "/assets/js/core/api.js")
    assert status == 200
    assert int(headers["content-length"]) > 0
    assert body == b""
    assert request(frontend, "POST", "/index.html", "ignored")[0] == 405
    status, headers, body = request(frontend, "GET", "/missing.html")
    assert status == 404
    assert b'Blind Barber' in body
    assert 'text/html' in headers['content-type']

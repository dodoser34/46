"""Static Pages artifacts must work from both / and /repository/ URLs."""
import hashlib
from html.parser import HTMLParser
import importlib.util
import json
from pathlib import Path
import re
from urllib.parse import unquote, urljoin, urlsplit

import pytest


ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("pages_build", ROOT / "scripts/pages/build.py")
pages_build = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pages_build)


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        self.urls.extend(value for key, value in attrs if key in {"href", "src", "action"} and value)


def snapshot_frontend():
    return {
        path.relative_to(pages_build.FRONTEND).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in pages_build.FRONTEND.rglob("*") if path.is_file()
    }


@pytest.fixture
def fake_export(monkeypatch):
    exported = {"products": [{"id": 1, "image": "/assets/img/products/pomade.jpg"}]}

    def write_export(path):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(exported), encoding="utf-8")

    monkeypatch.setattr(pages_build, "export_demo", write_export)
    return exported


@pytest.mark.parametrize("base", ["/", "/blind-barber-demo/"])
def test_complete_artifact_links_manifest_and_source_integrity(tmp_path, fake_export, base):
    before = snapshot_frontend()
    output = pages_build.build(tmp_path / "site", base)
    assert snapshot_frontend() == before
    assert (output / ".nojekyll").is_file()
    assert not list(output.rglob("*.cmd"))
    assert not list(output.rglob("*.md"))
    assert not list(output.rglob("__pycache__"))
    assert json.loads((output / "data/demo.json").read_text(encoding="utf-8")) == fake_export

    manifest = json.loads((output / "site.webmanifest").read_text(encoding="utf-8"))
    assert manifest["start_url"] == manifest["scope"] == manifest["id"] == base
    assert manifest["icons"][0]["src"] == base + "assets/img/brand/app-icon.svg"
    source_pages = {path.relative_to(pages_build.FRONTEND) for path in pages_build.FRONTEND.rglob("*.html")}
    assert {path.relative_to(output) for path in output.rglob("*.html")} == source_pages
    for page in output.rglob("*.html"):
        text = page.read_text(encoding="utf-8")
        config = "globalThis.BLIND_BARBER_DEMO=" + json.dumps({"basePath": base})
        assert config in text
        assert text.index(config) < text.index("type=\"module\"")
        links = Links()
        links.feed(text)
        for value in links.urls:
            parsed = urlsplit(value)
            if parsed.scheme or parsed.netloc or value.startswith("#"):
                continue
            current = "https://demo.invalid" + base + page.relative_to(output).as_posix()
            resolved = urlsplit(urljoin(current, value))
            assert resolved.path.startswith(base), (page, value)
            relative = unquote(resolved.path[len(base):]) or "index.html"
            assert (output / relative).is_file(), (page, value)
        # Inline module imports (including the 404 page) must also stay within
        # the repository path, rather than silently loading owner.github.io/assets.
        for resource in re.findall(r"\bfrom\s+['\"](/[^'\"]+)['\"]", text):
            assert resource.startswith(base)
            assert (output / resource[len(base):]).is_file()

    for script in (output / "assets/js").rglob("*.js"):
        text = script.read_text(encoding="utf-8")
        if base != "/":
            assert not re.search(r"['\"`]/(?:assets/|pages/)", text), script
    auth = (output / "assets/js/core/auth.js").read_text(encoding="utf-8")
    assert f"navigate(`{base}pages/login.html?next=" in auth
    login = (output / "assets/js/pages/login.js").read_text(encoding="utf-8")
    assert "nextRaw.startsWith('/')" in login
    assert "!nextRaw.startsWith('//')" in login
    assert f"'{base}pages/account.html'" in login
    account = (output / "assets/js/pages/account.js").read_text(encoding="utf-8")
    assert f"navigate('{base}')" in account


def test_rewrites_dynamic_and_origin_urls_without_changing_external_urls():
    source = """
        const sprite = '/assets/img/icons/sprite.svg';
        const path = `/pages/product.html?id=${id}`;
        const absolute = `${location.origin}/pages/account.html`;
        const absolute2 = window.location.origin + '/pages/cart.html';
        navigate('/'); location.assign('/');
        const safe = next.startsWith('/') && !next.startsWith('//');
        const external = 'https://example.org/assets/logo.svg';
        const protocolRelative = '//example.org/assets/logo.svg';
        const api = '/api'; const endpoint = '/orders';
        <a href="/">Home</a><a href="#reviews">Reviews</a>
        .hero { background: url(/assets/img/layers/home/bg.jpg); }
    """
    rewritten = pages_build.rewrite_text(source, "/demo/")
    assert "'/demo/assets/img/icons/sprite.svg'" in rewritten
    assert "`/demo/pages/product.html?id=${id}`" in rewritten
    assert "`${location.origin}/demo/pages/account.html`" in rewritten
    assert "window.location.origin + '/demo/pages/cart.html'" in rewritten
    assert "navigate('/demo/'); location.assign('/demo/');" in rewritten
    assert "next.startsWith('/') && !next.startsWith('//')" in rewritten
    assert "'https://example.org/assets/logo.svg'" in rewritten
    assert "'//example.org/assets/logo.svg'" in rewritten
    assert "const api = '/api'; const endpoint = '/orders';" in rewritten
    assert '<a href="/demo/">Home</a><a href="#reviews">Reviews</a>' in rewritten
    assert "url(/demo/assets/img/layers/home/bg.jpg)" in rewritten


@pytest.mark.parametrize("value", ["https://owner.github.io/repo/", "repo/", "//repo/", "/../", "/a/./", "/a//b/", "/repo/?x=1", "/repo/#x", "/a\\b/", "/bad name/", "/%2e%2e/"])
def test_invalid_base_paths_are_rejected_before_output_is_created(tmp_path, value):
    output = tmp_path / "invalid"
    with pytest.raises(ValueError):
        pages_build.build(output, value)
    assert not output.exists()


def test_rerun_removes_only_previous_build_files(tmp_path, fake_export):
    output = pages_build.build(tmp_path / "site", "/first/")
    stale = output / "assets/old-generated.js"
    stale.write_text("obsolete", encoding="utf-8")
    record_file = output / pages_build.MANIFEST
    record = json.loads(record_file.read_text(encoding="utf-8"))
    record["files"].append("assets/old-generated.js")
    record_file.write_text(json.dumps(record), encoding="utf-8")
    pages_build.build(output, "/second/")
    assert not stale.exists()
    assert '"basePath": "/second/"' in (output / "index.html").read_text(encoding="utf-8")
    personal = output / "personal.txt"
    personal.write_text("keep this", encoding="utf-8")
    with pytest.raises(ValueError, match="not created by"):
        pages_build.build(output, "/third/")
    assert personal.read_text(encoding="utf-8") == "keep this"
    assert (output / "index.html").is_file()


def test_output_cannot_overwrite_sources_or_unrelated_files(tmp_path, fake_export):
    for protected in (ROOT, ROOT / "frontend", ROOT / "frontend/assets", ROOT / "backend/data", ROOT / "scripts/pages"):
        with pytest.raises(ValueError, match="project root|project sources"):
            pages_build.build(protected)
    output = tmp_path / "unrelated"
    output.mkdir()
    note = output / "note.txt"
    note.write_text("keep me", encoding="utf-8")
    with pytest.raises(ValueError, match="not empty"):
        pages_build.build(output)
    assert note.read_text(encoding="utf-8") == "keep me"


def test_manifest_cannot_delete_files_outside_output(tmp_path, fake_export):
    output = pages_build.build(tmp_path / "site")
    outside = tmp_path / "private.txt"
    outside.write_text("keep me", encoding="utf-8")
    record_file = output / pages_build.MANIFEST
    record = json.loads(record_file.read_text(encoding="utf-8"))
    record["files"].append("../private.txt")
    record_file.write_text(json.dumps(record), encoding="utf-8")
    with pytest.raises(ValueError, match="unsafe path"):
        pages_build.build(output)
    assert outside.read_text(encoding="utf-8") == "keep me"
    assert (output / "index.html").is_file()

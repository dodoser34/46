#!/usr/bin/env python3
"""Build a self-contained GitHub Pages demo without changing frontend sources.

Usage: python scripts/pages/build.py --base-path /repository-name/
The Python backend is used only at build time to export the public demo catalog.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend"
MANIFEST = ".pages-build.json"
RUNTIME_SUFFIXES = {
    ".html", ".css", ".js", ".json", ".webmanifest", ".svg",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico",
    ".woff", ".woff2", ".ttf", ".otf", ".mp4", ".webm", ".mp3", ".wav",
}
TEXT_SUFFIXES = {".html", ".css", ".js", ".json", ".webmanifest", ".svg"}


def normalize_base_path(value: str) -> str:
    """Accept root or a slash-separated GitHub repository path, never a URL."""
    if value == "/":
        return value
    if not re.fullmatch(r"/(?:[A-Za-z0-9._~-]+/)*[A-Za-z0-9._~-]+/?", value):
        raise ValueError("--base-path must be / or a path such as /blind-barber-demo/")
    if any(part in {".", ".."} for part in value.strip("/").split("/")):
        raise ValueError("--base-path cannot contain . or .. segments")
    return value.rstrip("/") + "/"


def rewrite_text(text: str, base_path: str) -> str:
    """Prefix site URLs, keeping API endpoints, external URLs and checks intact.

    Pages are physical .html files. Root-relative URL literals occur in HTML,
    JS templates, JS navigation, SVG references, and (potentially) CSS url().
    Rewriting only known runtime roots avoids changing '/api', startsWith('/'),
    protocol-relative URLs, CSS data URLs, and separators used by application code.
    """
    if base_path == "/":
        return text
    roots = r"(?:assets/|pages/|site\.webmanifest\b)"
    text = re.sub(
        rf"(?P<delimiter>[\"'`])/(?P<path>{roots})",
        lambda match: match["delimiter"] + base_path + match["path"],
        text,
    )
    text = re.sub(
        rf"(?P<origin>\$\{{(?:window\.)?location\.origin\}})/(?P<path>{roots})",
        lambda match: match["origin"] + base_path + match["path"],
        text,
    )
    text = re.sub(
        rf"(?P<url>url\(\s*)/(?P<path>{roots})",
        lambda match: match["url"] + base_path + match["path"],
        text,
        flags=re.IGNORECASE,
    )
    # A slash by itself is also meaningful to validation code; limit home URL
    # replacements to HTML attributes, link properties, and navigation calls.
    text = re.sub(
        r"(?P<attribute>\b(?:href|src|action)\s*=\s*)(?P<quote>[\"'])/(?P=quote)",
        lambda match: match["attribute"] + match["quote"] + base_path + match["quote"],
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r"(?P<call>\b(?:navigate|(?:window\.)?location\.(?:assign|replace))\(\s*)"
        r"(?P<quote>[\"'`])/(?P=quote)",
        lambda match: match["call"] + match["quote"] + base_path + match["quote"],
        text,
    )
    text = re.sub(
        r"(?P<property>\bhref\s*:\s*)(?P<quote>[\"'])/(?P=quote)",
        lambda match: match["property"] + match["quote"] + base_path + match["quote"],
        text,
    )
    return text


def runtime_files():
    for source in sorted(FRONTEND.rglob("*")):
        relative = source.relative_to(FRONTEND)
        if not source.is_file() or source.is_symlink():
            continue
        if any(part.startswith(".") or part == "__pycache__" for part in relative.parts):
            continue
        if source.suffix.lower() not in RUNTIME_SUFFIXES:
            continue
        if len(relative.parts) == 1 or relative.parts[0] in {"assets", "pages", "data"}:
            yield source, relative


def prepare_output(output: Path) -> Path:
    """Refuse source folders and remove only files from our previous manifest."""
    output = output.resolve()
    if output == ROOT or output in ROOT.parents:
        raise ValueError("Output must be a dedicated build directory, not the project root")
    for directory in ("frontend", "backend", "scripts", "docs", "assets-src", ".git"):
        protected = (ROOT / directory).resolve()
        if output == protected or protected in output.parents:
            raise ValueError(f"Output cannot overwrite project sources: {protected}")
    output.mkdir(parents=True, exist_ok=True)
    previous = output / MANIFEST
    present = [path for path in output.rglob("*") if path.is_file() or path.is_symlink()]
    if present and not previous.is_file():
        raise ValueError("Output is not empty and has no Pages build manifest; choose another directory")
    if previous.is_file():
        record = json.loads(previous.read_text(encoding="utf-8"))
        if record.get("builder") != "blind-barber-pages-v1" or not isinstance(record.get("files"), list):
            raise ValueError("Output has an invalid Pages build manifest")
        generated = set()
        for name in record["files"]:
            if not isinstance(name, str):
                raise ValueError("Output manifest contains an invalid filename")
            candidate = output / name
            resolved = candidate.resolve()
            if candidate.is_symlink() or resolved == output or output not in resolved.parents:
                raise ValueError("Output manifest contains an unsafe path")
            generated.add(candidate)
        unknown = set(present) - generated - {previous}
        if unknown:
            raise ValueError("Output contains files not created by the Pages builder; choose another directory")
        # Every path has been resolved and checked; no recursive deletion is used.
        for path in generated:
            if path.is_file():
                path.unlink()
        previous.unlink()
    return output


def export_demo(output_file: Path) -> None:
    output_file.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "pages" / "export_demo.py"), "--output", str(output_file)],
        cwd=ROOT,
        check=True,
    )


def build(output: Path, base_path: str = "/") -> Path:
    base_path = normalize_base_path(base_path)
    output = prepare_output(Path(output))
    files = []
    config = "<script>globalThis.BLIND_BARBER_DEMO=" + json.dumps({"basePath": base_path}) + ";</script>"
    for source, relative in runtime_files():
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if source.suffix.lower() in TEXT_SUFFIXES:
            text = rewrite_text(source.read_text(encoding="utf-8"), base_path)
            if source.suffix.lower() == ".html":
                text, count = re.subn(r"(<head\b[^>]*>)", lambda match: match[0] + "\n  " + config, text, count=1, flags=re.IGNORECASE)
                if count != 1:
                    raise ValueError(f"HTML page has no <head>: {relative}")
            elif source.suffix.lower() == ".webmanifest":
                manifest = json.loads(text)
                manifest.update(start_url=base_path, scope=base_path, id=base_path)
                text = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
            target.write_text(text, encoding="utf-8", newline="\n")
        else:
            target.write_bytes(source.read_bytes())
        files.append(relative.as_posix())

    data_file = output / "data" / "demo.json"
    export_demo(data_file)
    # Validate the export. The demo API prefixes its catalog image paths at
    # runtime so the same data schema works at both root and repository URLs.
    json.loads(data_file.read_text(encoding="utf-8"))
    files.append("data/demo.json")
    (output / ".nojekyll").touch()
    files.append(".nojekyll")
    (output / MANIFEST).write_text(json.dumps({"builder": "blind-barber-pages-v1", "files": sorted(set(files))}, indent=2) + "\n", encoding="utf-8")
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "dist" / "pages", help="Dedicated artifact directory (default: dist/pages)")
    parser.add_argument("--base-path", default="/", help="GitHub Pages URL prefix, e.g. /blind-barber-demo/")
    args = parser.parse_args()
    try:
        output = build(args.output, args.base_path)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"Pages build failed: {error}\n")
    print(f"Pages demo built: {output} (base path: {normalize_base_path(args.base_path)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

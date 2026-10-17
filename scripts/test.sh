#!/usr/bin/env sh
cd "$(dirname "$0")/../backend"
exec .venv/bin/pytest -v

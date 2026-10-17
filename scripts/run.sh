#!/usr/bin/env sh
set -e
exec python3 "$(dirname "$0")/dev/launcher.py" all "$@"

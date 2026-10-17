#!/usr/bin/env bash
# Резервная копия базы SQLite. Хранятся копии за последние 14 дней.
# Ставится скриптом install.sh в /usr/local/bin/barber-backup и запускается каждый день в 03:30.
set -euo pipefail
APP_DIR=/opt/barber
BACKUP_DIR="$APP_DIR/data/backups"
runuser -u barber -- bash -c "set -a; source '$APP_DIR/backend/.env'; set +a; cd '$APP_DIR/backend' && .venv/bin/python -m app.manage backup --out '$BACKUP_DIR'"
find "$BACKUP_DIR" -name 'barber-*.db' -mtime +14 -delete

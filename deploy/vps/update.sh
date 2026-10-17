#!/usr/bin/env bash
# Обновление уже установленного сайта новой версией кода.
#   cd папка-проекта && git pull   (или скопируйте новые файлы)
#   sudo bash deploy/vps/update.sh
# Настройки (backend/.env) и база данных не затрагиваются. Перед обновлением делается резервная копия.
set -euo pipefail
APP_DIR=/opt/barber
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ $EUID -ne 0 ]]; then echo "Запустите через sudo"; exit 1; fi

echo "==> Резервная копия базы"
/usr/local/bin/barber-backup || true

echo "==> Копирую новый код"
rsync -a --delete \
  --exclude ".git" --exclude "backend/.venv" --exclude "backend/data" --exclude "backend/.env" \
  --exclude "/data" --exclude "_old_react_scaffold" --exclude "assets-src" --exclude "**/__pycache__" \
  "$SRC_DIR/" "$APP_DIR/"
chown -R barber:barber "$APP_DIR"

echo "==> Обновляю библиотеки и базу"
"$APP_DIR/backend/.venv/bin/pip" install -q -r "$APP_DIR/backend/requirements.txt"
runuser -u barber -- bash -c "set -a; source '$APP_DIR/backend/.env'; set +a; cd '$APP_DIR/backend' && .venv/bin/python -m app.manage init-db"

echo "==> Перезапуск"
cp "$APP_DIR/deploy/systemd/barber.service" /etc/systemd/system/barber.service
systemctl daemon-reload
systemctl restart barber
sleep 2
curl -fsS http://127.0.0.1:8000/api/health && echo && echo "Обновление завершено"

#!/usr/bin/env bash
# Установка Blind Barber на чистый сервер Ubuntu 22.04 / 24.04 одной командой.
#
#   1) Скопируйте папку проекта на сервер (git clone … или scp -r) и зайдите в неё.
#   2) Запустите:
#        sudo bash deploy/vps/install.sh barber.kz admin@mail.kz     # с доменом и HTTPS
#        sudo bash deploy/vps/install.sh                             # без домена, по IP-адресу
#
# Скрипт можно запускать повторно — он ничего не сломает и не перезапишет пароль администратора.
set -euo pipefail

DOMAIN="${1:-}"
CERT_EMAIL="${2:-}"
APP_DIR=/opt/barber
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ $EUID -ne 0 ]]; then echo "Запустите через sudo"; exit 1; fi

echo "==> 1/8 Устанавливаю системные пакеты"
apt-get update -qq
apt-get install -y -qq python3 python3-venv python3-pip nginx rsync curl
if [[ -n "$DOMAIN" ]]; then apt-get install -y -qq certbot python3-certbot-nginx; fi

echo "==> 2/8 Создаю системного пользователя barber"
id barber &>/dev/null || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin barber

echo "==> 3/8 Копирую проект в $APP_DIR"
mkdir -p "$APP_DIR" "$APP_DIR/data"
rsync -a --delete \
  --exclude ".git" --exclude "backend/.venv" --exclude "backend/data" --exclude "backend/.env" \
  --exclude "/data" --exclude "_old_react_scaffold" --exclude "assets-src" --exclude "**/__pycache__" \
  "$SRC_DIR/" "$APP_DIR/"

echo "==> 4/8 Устанавливаю Python-библиотеки"
python3 -m venv "$APP_DIR/backend/.venv"
"$APP_DIR/backend/.venv/bin/pip" install -q --upgrade pip
"$APP_DIR/backend/.venv/bin/pip" install -q -r "$APP_DIR/backend/requirements.txt"

echo "==> 5/8 Настройки (backend/.env)"
ENV_FILE="$APP_DIR/backend/.env"
NEW_PASSWORD=""
if [[ ! -f "$ENV_FILE" ]]; then
  NEW_PASSWORD="$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 20)"
  cat > "$ENV_FILE" <<ENV
ENV=production
APP_NAME="Blind Barber"
DATA_DIR=$APP_DIR/data
FRONTEND_DIR=$APP_DIR/frontend
INIT_DB_ON_STARTUP=false
SEED_DEMO_DATA=true
ADMIN_EMAIL=admin@barber.kz
ADMIN_PASSWORD=$NEW_PASSWORD
TOKEN_TTL_DAYS=30
LOGIN_MAX_ATTEMPTS=8
LOGIN_WINDOW_MINUTES=15
ENV
  chmod 600 "$ENV_FILE"
fi
chown -R barber:barber "$APP_DIR"

echo "==> 6/8 Готовлю базу данных"
runuser -u barber -- bash -c "set -a; source '$ENV_FILE'; set +a; cd '$APP_DIR/backend' && .venv/bin/python -m app.manage init-db"

echo "==> 7/8 Запускаю сервис и nginx"
cp "$APP_DIR/deploy/systemd/barber.service" /etc/systemd/system/barber.service
systemctl daemon-reload
systemctl enable --now barber
systemctl restart barber

sed "s/DOMAIN_PLACEHOLDER/${DOMAIN:-_}/" "$APP_DIR/deploy/nginx/barber.conf" > /etc/nginx/sites-available/barber
ln -sf /etc/nginx/sites-available/barber /etc/nginx/sites-enabled/barber
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# Ежедневная резервная копия базы в 03:30
cp "$APP_DIR/deploy/vps/backup.sh" /usr/local/bin/barber-backup
chmod +x /usr/local/bin/barber-backup
echo "30 3 * * * root /usr/local/bin/barber-backup >/var/log/barber-backup.log 2>&1" > /etc/cron.d/barber-backup

echo "==> 8/8 Проверка"
for i in {1..15}; do
  if curl -fsS http://127.0.0.1:8000/api/health >/dev/null; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:8000/api/health && echo

if [[ -n "$DOMAIN" && -n "$CERT_EMAIL" ]]; then
  echo "==> Включаю HTTPS для $DOMAIN"
  certbot --nginx --non-interactive --agree-tos -m "$CERT_EMAIL" -d "$DOMAIN" --redirect || \
    echo "!! HTTPS не включился. Проверьте, что домен указывает на IP этого сервера, и повторите: certbot --nginx -d $DOMAIN"
fi

echo
echo "Готово! Сайт: http://${DOMAIN:-$(curl -fsS ifconfig.me 2>/dev/null || echo 'IP-адрес-сервера')}"
if [[ -n "$NEW_PASSWORD" ]]; then
  echo "Вход администратора: admin@barber.kz / $NEW_PASSWORD   (сохраните пароль!)"
fi
echo "Обновить сайт после изменений: sudo bash deploy/vps/update.sh"

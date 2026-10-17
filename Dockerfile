# Образ приложения Blind Barber: FastAPI раздаёт и API, и статический фронтенд.
# Сборка:  docker build -t blind-barber .
# Запуск:  docker run -p 8000:8000 -e ADMIN_PASSWORD=... -v barber-data:/app/data blind-barber
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DATA_DIR=/app/data \
    FRONTEND_DIR=/app/frontend \
    PORT=8000 \
    WEB_CONCURRENCY=1 \
    INIT_DB_ON_STARTUP=false

WORKDIR /app/backend

# Сначала только зависимости — при изменении кода этот слой берётся из кэша, сборка быстрее.
COPY backend/requirements.txt .
RUN pip install -r requirements.txt

COPY backend/app ./app
COPY frontend /app/frontend

RUN useradd --create-home --uid 10001 barber && mkdir -p /app/data && chown -R barber /app/data
USER barber

VOLUME ["/app/data"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,os; urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/api/health', timeout=4)"

# 1) подготовить базу (один раз, до запуска воркеров), 2) запустить сервер.
# WEB_CONCURRENCY — число процессов: 1 для SQLite, 2–4 для PostgreSQL.
CMD ["sh", "-c", "python -m app.manage init-db && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers ${WEB_CONCURRENCY} --proxy-headers --forwarded-allow-ips='*'"]

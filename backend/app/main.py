"""Точка входа приложения Blind Barber: REST API + раздача фронтенда.

Запуск для разработки (из папки backend):
    uvicorn app.main:app --reload
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.exception_handlers import http_exception_handler
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import api_router
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.seed import seed

logging.basicConfig(level=logging.DEBUG if settings.debug else logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("barber")


def init_db() -> None:
    """Создать таблицы (если их нет) и при необходимости заполнить демо-данными."""
    Base.metadata.create_all(engine)
    if settings.seed_demo_data:
        with SessionLocal() as db:
            seed(db)


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.check_production()
    if settings.init_db_on_startup:
        init_db()
    db_kind = "SQLite" if settings.is_sqlite else "PostgreSQL"
    log.info("%s запущен: режим %s, база %s", settings.app_name, settings.environment, db_kind)
    yield


app = FastAPI(
    title=f"{settings.app_name} API",
    description="Сервис онлайн-записи в барбершопы и интернет-магазин средств для ухода.",
    version="1.1.0",
    lifespan=lifespan,
    debug=settings.debug,
)

# Сжатие ответов (HTML, CSS, JS, JSON) — страницы грузятся быстрее.
app.add_middleware(GZipMiddleware, minimum_size=800)

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_origins,
        allow_methods=["*"], allow_headers=["*"],
    )


@app.middleware("http")
async def security_and_cache_headers(request: Request, call_next):
    response = await call_next(request)
    headers = response.headers
    # Базовые заголовки безопасности
    headers.setdefault("X-Content-Type-Options", "nosniff")
    headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    headers.setdefault("Permissions-Policy", "geolocation=(self), camera=(), microphone=()")
    if request.url.scheme == "https":
        headers.setdefault("Strict-Transport-Security", "max-age=31536000")
    # Статика всегда перепроверяется по ETag — после обновления сайта браузер не держит старые файлы.
    if not request.url.path.startswith("/api"):
        headers.setdefault("Cache-Control", "no-cache")
    return response


app.include_router(api_router)


@app.exception_handler(StarletteHTTPException)
async def page_not_found(request: Request, exc: StarletteHTTPException):
    path = request.url.path
    api_path = path == "/api" or path.startswith("/api/")
    page = settings.frontend_dir / "404.html"
    if exc.status_code == 404 and settings.serve_frontend and not api_path and page.is_file():
        return FileResponse(page, status_code=404)
    return await http_exception_handler(request, exc)

class FrontendFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        # Несуществующий API должен вернуть JSON, а не HTML-страницу 404 из StaticFiles.
        normalized = path.replace("\\", "/").lstrip("/")
        if normalized == "api" or normalized.startswith("api/"):
            raise StarletteHTTPException(status_code=404, detail="Not Found")
        return await super().get_response(path, scope)


# Фронтенд раздаётся тем же сервером. Монтируется последним, чтобы не перекрывать /api и /docs.
if settings.serve_frontend and settings.frontend_dir.exists():
    app.mount("/", FrontendFiles(directory=settings.frontend_dir, html=True), name="frontend")

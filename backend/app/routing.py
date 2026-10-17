"""HTTP-слой: все роутеры API собираются в один."""
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.modules.accounts import routes as auth
from app.modules.administration import routes as admin
from app.modules.booking import routes as bookings
from app.modules.catalog import routes as catalog
from app.modules.shop import routes as shop

api_router = APIRouter()
for _module in (auth, catalog, bookings, shop, admin):
    api_router.include_router(_module.router)


@api_router.get("/api/health", tags=["Служебное"])
def health(db: Session = Depends(get_db)):
    """Проверка для хостинга: сервер жив и база данных отвечает."""
    try:
        db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 — любая ошибка базы = сервис нездоров
        return JSONResponse({"status": "error", "database": "unavailable"}, status_code=503)
    return {"status": "ok", "database": "ok"}

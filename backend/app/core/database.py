"""Подключение к базе данных через SQLAlchemy (SQLite локально, PostgreSQL на хостинге)."""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

if settings.is_sqlite:
    engine = create_engine(settings.database_url, connect_args={"check_same_thread": False, "timeout": 15})

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")     # соблюдать связи между таблицами
        cursor.execute("PRAGMA journal_mode=WAL")    # чтение не блокирует запись
        cursor.close()
else:
    # pool_pre_ping — проверять соединение перед использованием (хостинги закрывают «простаивающие»)
    engine = create_engine(settings.database_url, pool_pre_ping=True, pool_size=5, max_overflow=5)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """Зависимость FastAPI: открывает сессию на время запроса."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

"""Настройки приложения из переменных окружения (см. backend/.env.example)."""
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parent

DEFAULT_ADMIN_PASSWORD = "admin123"


def _load_env_file(path: Path) -> None:
    """Минимальный загрузчик .env без внешних зависимостей. Переменные окружения важнее файла."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


def normalize_database_url(url: str) -> str:
    """Хостинги (Render, Railway, Heroku) выдают адрес вида postgres://…,
    а SQLAlchemy с драйвером psycopg 3 ждёт postgresql+psycopg://…"""
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


_load_env_file(BACKEND_DIR / ".env")


class Settings:
    def __init__(self) -> None:
        self.app_name: str = os.getenv("APP_NAME", "Blind Barber")
        # development — локальная разработка, production — сайт в интернете
        self.environment: str = os.getenv("ENV", "development").strip().lower()
        self.debug: bool = _bool("DEBUG", False)

        self.data_dir: Path = Path(os.getenv("DATA_DIR", BACKEND_DIR / "data"))
        self.frontend_dir: Path = Path(os.getenv("FRONTEND_DIR", PROJECT_DIR / "frontend"))
        self.serve_frontend: bool = _bool("SERVE_FRONTEND", True)
        database_url = os.getenv("DATABASE_URL", "").strip()
        if not database_url:
            self.data_dir.mkdir(parents=True, exist_ok=True)
            database_url = f"sqlite:///{(self.data_dir / 'barber.db').as_posix()}"
        self.database_url: str = normalize_database_url(database_url)

        # Создавать таблицы и демо-данные при старте сервера. В Docker это делает
        # отдельная команда `python -m app.manage init-db` до запуска, поэтому там false.
        self.init_db_on_startup: bool = _bool("INIT_DB_ON_STARTUP", True)
        self.seed_demo_data: bool = _bool("SEED_DEMO_DATA", True)

        self.admin_email: str = os.getenv("ADMIN_EMAIL", "admin@barber.kz").strip().lower()
        self.admin_password: str = os.getenv("ADMIN_PASSWORD", DEFAULT_ADMIN_PASSWORD)

        # Безопасность входа
        self.token_ttl_days: int = int(os.getenv("TOKEN_TTL_DAYS", "30"))
        self.login_max_attempts: int = int(os.getenv("LOGIN_MAX_ATTEMPTS", "8"))
        self.login_window_minutes: int = int(os.getenv("LOGIN_WINDOW_MINUTES", "15"))

        self.cors_origins: list[str] = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    def check_production(self) -> None:
        """Не даём запустить сайт в интернете со стандартным паролем администратора."""
        if self.is_production and self.seed_demo_data and self.admin_password == DEFAULT_ADMIN_PASSWORD:
            raise RuntimeError(
                "ENV=production, но ADMIN_PASSWORD не задан (стоит стандартный admin123). "
                "Задайте надёжный пароль в переменной окружения ADMIN_PASSWORD."
            )


settings = Settings()

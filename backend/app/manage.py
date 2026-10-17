"""Служебные команды для сервера. Запуск из папки backend:

    python -m app.manage init-db                      создать таблицы и демо-данные (если база пустая)
    python -m app.manage create-admin --email a@b.kz --password "Пароль123" [--name "Имя"]
    python -m app.manage set-password --email a@b.kz --password "НовыйПароль"
    python -m app.manage backup [--out backups/]      резервная копия базы SQLite
    python -m app.manage check                        проверить настройки и подключение к базе
"""
import argparse
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import select, text

from app import models
from app.core.config import settings
from app.core.database import SessionLocal, engine
from app.core.security import hash_password


def cmd_init_db(_: argparse.Namespace) -> None:
    from app.main import init_db

    settings.check_production()
    init_db()
    print("Готово: таблицы созданы" + (", демо-данные загружены (если база была пустой)" if settings.seed_demo_data else ""))


def cmd_create_admin(args: argparse.Namespace) -> None:
    if len(args.password) < 8:
        sys.exit("Пароль администратора должен быть не короче 8 символов")
    with SessionLocal() as db:
        user = db.scalar(select(models.User).where(models.User.email == args.email.lower()))
        if user:
            user.is_admin = True
            user.password_hash = hash_password(args.password)
            action = "обновлён и назначен администратором"
        else:
            user = models.User(name=args.name, email=args.email.lower(), phone="",
                               password_hash=hash_password(args.password), is_admin=True)
            db.add(user)
            action = "создан"
        db.commit()
    print(f"Администратор {args.email} {action}")


def cmd_set_password(args: argparse.Namespace) -> None:
    with SessionLocal() as db:
        user = db.scalar(select(models.User).where(models.User.email == args.email.lower()))
        if not user:
            sys.exit(f"Пользователь {args.email} не найден")
        user.password_hash = hash_password(args.password)
        # Выходим со всех устройств: старые токены больше не действуют.
        for token in db.scalars(select(models.AuthToken).where(models.AuthToken.user_id == user.id)):
            db.delete(token)
        db.commit()
    print(f"Пароль для {args.email} изменён, все старые входы сброшены")


def cmd_backup(args: argparse.Namespace) -> None:
    if not settings.is_sqlite:
        sys.exit("Для PostgreSQL используйте резервные копии хостинга или команду pg_dump")
    source = Path(settings.database_url.removeprefix("sqlite:///"))
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / f"barber-{datetime.now():%Y%m%d-%H%M%S}.db"
    # Встроенный механизм SQLite копирует базу корректно даже во время работы сервера.
    with sqlite3.connect(source) as src, sqlite3.connect(target) as dst:
        src.backup(dst)
    print(f"Резервная копия: {target}")


def cmd_check(_: argparse.Namespace) -> None:
    print(f"Режим:        {settings.environment}")
    print(f"База данных:  {'SQLite' if settings.is_sqlite else 'PostgreSQL'}")
    print(f"Фронтенд:     {settings.frontend_dir} ({'найден' if settings.frontend_dir.exists() else 'НЕ НАЙДЕН'})")
    print(f"Демо-данные:  {'да' if settings.seed_demo_data else 'нет'}")
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    print("Подключение к базе: OK")
    try:
        settings.check_production()
        print("Проверка безопасности: OK")
    except RuntimeError as err:
        sys.exit(f"Проверка безопасности: ОШИБКА — {err}")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.manage", description="Управление Blind Barber")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init-db", help="создать таблицы и демо-данные").set_defaults(func=cmd_init_db)

    p = sub.add_parser("create-admin", help="создать администратора или сделать пользователя админом")
    p.add_argument("--email", required=True)
    p.add_argument("--password", required=True)
    p.add_argument("--name", default="Администратор")
    p.set_defaults(func=cmd_create_admin)

    p = sub.add_parser("set-password", help="сменить пароль пользователя")
    p.add_argument("--email", required=True)
    p.add_argument("--password", required=True)
    p.set_defaults(func=cmd_set_password)

    p = sub.add_parser("backup", help="резервная копия базы SQLite")
    p.add_argument("--out", default=str(settings.data_dir / "backups"))
    p.set_defaults(func=cmd_backup)

    sub.add_parser("check", help="проверить настройки").set_defaults(func=cmd_check)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()

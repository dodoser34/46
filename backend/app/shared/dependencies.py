"""Общие зависимости эндпоинтов: сессия БД и текущий пользователь."""
from datetime import datetime, timedelta

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.modules.accounts.models import AuthToken
from app.modules.accounts.models import User

__all__ = ["get_db", "get_optional_user", "get_current_user", "get_admin"]


def _extract_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, value = authorization.partition(" ")
    if scheme.lower() != "bearer" or not value:
        return None
    return value.strip()


def get_optional_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User | None:
    token = _extract_token(authorization)
    if not token:
        return None
    row = db.get(AuthToken, token)
    if not row:
        return None
    if row.created_at < datetime.now() - timedelta(days=settings.token_ttl_days):
        # Токен устарел — удаляем, пользователю нужно войти заново.
        db.delete(row)
        db.commit()
        return None
    return row.user


def get_current_user(user: User | None = Depends(get_optional_user)) -> User:
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Требуется вход в аккаунт")
    return user


def get_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Доступ только для администратора")
    return user

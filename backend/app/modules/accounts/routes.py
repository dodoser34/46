"""Регистрация, вход и профиль пользователя."""
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.accounts.models import AuthToken, User
from app.modules.accounts.schemas import LoginIn, ProfileIn, RegisterIn, TokenOut, UserOut
from app.shared.dependencies import get_current_user, get_db
from app.core.rate_limit import login_limiter
from app.core.security import hash_password, new_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["Авторизация"])


def create_token(db: Session, user: User) -> str:
    token = new_token()
    db.add(AuthToken(token=token, user_id=user.id))
    db.commit()
    return token


@router.post("/register", response_model=TokenOut, status_code=201)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    email = data.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Пользователь с таким email уже существует")
    user = User(
        name=data.name.strip(), email=email, phone=data.phone,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    return {"token": create_token(db, user), "user": user}


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, request: Request, db: Session = Depends(get_db)):
    key = login_limiter.key(client_ip(request), data.email)
    login_limiter.check(key)  # 429, если подряд слишком много неудачных попыток
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if not user or not verify_password(data.password, user.password_hash):
        login_limiter.fail(key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный email или пароль")
    login_limiter.reset(key)
    return {"token": create_token(db, user), "user": user}


@router.post("/logout", status_code=204)
def logout(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    if authorization and authorization.lower().startswith("bearer "):
        row = db.get(AuthToken, authorization[7:].strip())
        if row:
            db.delete(row)
            db.commit()


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_me(data: ProfileIn, user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    user = db.merge(user)
    user.name = data.name.strip()
    user.phone = data.phone
    db.commit()
    return user

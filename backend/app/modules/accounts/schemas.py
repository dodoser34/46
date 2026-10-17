"""Регистрация, вход, профиль."""
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.shared.validation import ClientName, ORM, check_phone


class RegisterIn(BaseModel):
    name: ClientName
    email: EmailStr
    phone: str = ""
    password: str = Field(min_length=6, max_length=128)

    @field_validator("phone")
    @classmethod
    def phone_ok(cls, v: str) -> str:
        return check_phone(v) if v.strip() else ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORM):
    id: int
    name: str
    email: str
    phone: str
    is_admin: bool


class TokenOut(BaseModel):
    token: str
    user: UserOut


class ProfileIn(BaseModel):
    name: ClientName
    phone: str = ""

    @field_validator("phone")
    @classmethod
    def phone_ok(cls, v: str) -> str:
        return check_phone(v) if v.strip() else ""

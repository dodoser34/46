"""Магазин и заказы."""
from pydantic import BaseModel, EmailStr, Field, field_validator

from .common import ClientName, ORM, check_phone


class CategoryOut(ORM):
    id: int
    name: str
    slug: str


class ProductOut(BaseModel):
    id: int
    name: str
    brand: str
    volume: str
    price: int
    short: str
    description: str
    usage: str
    image: str
    badge: str
    rating: float
    reviews_count: int
    in_stock: bool
    category: str
    category_slug: str


class OrderItemIn(BaseModel):
    product_id: int
    qty: int = Field(ge=1, le=20)


class OrderIn(BaseModel):
    items: list[OrderItemIn] = Field(min_length=1, max_length=50)
    client_name: ClientName
    client_phone: str
    delivery: str = Field(pattern=r"^(pickup|courier)$")
    address: str = Field(default="", max_length=255)
    comment: str = Field(default="", max_length=500)

    @field_validator("client_phone")
    @classmethod
    def phone_ok(cls, v: str) -> str:
        return check_phone(v)


class OrderItemOut(ORM):
    product_id: int
    name: str
    price: int
    qty: int


class OrderOut(BaseModel):
    id: int
    client_name: str
    client_phone: str
    delivery: str
    address: str
    comment: str
    delivery_fee: int
    total: int
    status: str
    created_at: str
    items: list[OrderItemOut]


class SubscribeIn(BaseModel):
    email: EmailStr

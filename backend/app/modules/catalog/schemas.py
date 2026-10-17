"""Города, услуги, барбершопы, мастера, отзывы."""
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.shared.validation import ORM


class CityOut(ORM):
    id: int
    name: str
    slug: str


class ServiceOut(ORM):
    id: int
    name: str
    slug: str
    description: str
    price: int
    duration: int
    image: str


class MasterShort(BaseModel):
    id: int
    name: str
    title: str
    photo: str
    rating: float
    reviews_count: int
    experience: int
    specializations: list[str]


class MasterOut(MasterShort):
    bio: str
    works: list[str]
    barbershop_id: int
    barbershop_name: str
    barbershop_address: str


class BarbershopShort(BaseModel):
    id: int
    name: str
    slug: str
    city: str
    address: str
    open_time: str
    close_time: str
    is_open: bool
    rating: float
    reviews_count: int
    cover: str
    distance_km: float | None = None
    is_favorite: bool = False


class BarbershopOut(BarbershopShort):
    phone: str
    description: str
    images: list[str]
    lat: float
    lng: float
    masters: list[MasterShort]


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=1000)]
    master_id: int | None = None


class ReviewOut(ORM):
    id: int
    author: str
    rating: int
    text: str
    master_id: int | None
    created_at: str

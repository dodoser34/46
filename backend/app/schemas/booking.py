"""Онлайн-запись."""
from datetime import date as date_type

from pydantic import BaseModel, Field, field_validator

from .common import ClientName, check_phone


class SlotsOut(BaseModel):
    date: str
    slots: list[dict]  # [{"time": "13:00", "available": true}]


class BookingIn(BaseModel):
    barbershop_id: int
    master_id: int
    service_id: int
    date: date_type
    time: str = Field(pattern=r"^\d{2}:\d{2}$")
    client_name: ClientName
    client_phone: str
    comment: str = Field(default="", max_length=500)

    @field_validator("client_phone")
    @classmethod
    def phone_ok(cls, v: str) -> str:
        return check_phone(v)


class BookingOut(BaseModel):
    id: int
    barbershop: str
    barbershop_id: int
    address: str
    master: str
    master_id: int
    service: str
    date: str
    time: str
    duration: int
    price: int
    client_name: str
    client_phone: str
    comment: str
    status: str
    created_at: str


class StatusIn(BaseModel):
    status: str

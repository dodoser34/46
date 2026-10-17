"""Общие элементы схем: базовый класс и проверка телефона."""
import re
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

ClientName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]

PHONE_RE = re.compile(r"^\+?[0-9\s()\-]{10,20}$")


def check_phone(value: str) -> str:
    value = value.strip()
    digits = re.sub(r"\D", "", value)
    if not PHONE_RE.match(value) or not 10 <= len(digits) <= 12:
        raise ValueError("Введите корректный номер телефона")
    return value


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)

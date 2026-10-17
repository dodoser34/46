"""Pydantic-схемы: валидация входящих данных и формат ответов API."""
from .auth import LoginIn, ProfileIn, RegisterIn, TokenOut, UserOut
from .booking import BookingIn, BookingOut, SlotsOut, StatusIn
from .catalog import (
    BarbershopOut, BarbershopShort, CityOut, MasterOut, MasterShort, ReviewIn, ReviewOut,
    ServiceOut,
)
from .shop import (
    CategoryOut, OrderIn, OrderItemIn, OrderItemOut, OrderOut, ProductOut,
    SubscribeIn,
)

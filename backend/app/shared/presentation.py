"""Преобразование ORM-объектов в ответы API."""
import math
from datetime import datetime

from app.modules.booking.models import Booking
from app.modules.catalog.models import Barbershop, Master, Review
from app.modules.shop.models import Order, Product


def split_list(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def to_minutes(hhmm: str) -> int:
    hours, minutes = hhmm.split(":")
    return int(hours) * 60 + int(minutes)


def from_minutes(total: int) -> str:
    return f"{total // 60:02d}:{total % 60:02d}"


def is_open_now(shop: Barbershop, now: datetime | None = None) -> bool:
    now = now or datetime.now()
    current = now.hour * 60 + now.minute
    return to_minutes(shop.open_time) <= current < to_minutes(shop.close_time)


def distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Расстояние по формуле гаверсинусов."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)), 1)


def master_short(m: Master) -> dict:
    return {
        "id": m.id,
        "name": m.name,
        "title": m.title,
        "photo": m.photo,
        "rating": m.rating,
        "reviews_count": m.reviews_count,
        "experience": m.experience,
        "specializations": split_list(m.specializations),
    }


def master_full(m: Master) -> dict:
    return {
        **master_short(m),
        "bio": m.bio,
        "works": split_list(m.works),
        "barbershop_id": m.barbershop_id,
        "barbershop_name": m.barbershop.name,
        "barbershop_address": m.barbershop.address,
    }


def barbershop_short(shop: Barbershop, favorites: set[int] | None = None,
                     origin: tuple[float, float] | None = None) -> dict:
    images = split_list(shop.images)
    return {
        "id": shop.id,
        "name": shop.name,
        "slug": shop.slug,
        "city": shop.city.name,
        "address": shop.address,
        "open_time": shop.open_time,
        "close_time": shop.close_time,
        "is_open": is_open_now(shop),
        "rating": shop.rating,
        "reviews_count": shop.reviews_count,
        "cover": images[0] if images else "",
        "distance_km": distance_km(origin[0], origin[1], shop.lat, shop.lng) if origin else None,
        "is_favorite": bool(favorites and shop.id in favorites),
    }


def barbershop_full(shop: Barbershop, favorites: set[int] | None = None) -> dict:
    return {
        **barbershop_short(shop, favorites),
        "phone": shop.phone,
        "description": shop.description,
        "images": split_list(shop.images),
        "lat": shop.lat,
        "lng": shop.lng,
        "masters": [master_short(m) for m in shop.masters],
    }


def review(r: Review) -> dict:
    return {
        "id": r.id,
        "author": r.author,
        "rating": r.rating,
        "text": r.text,
        "master_id": r.master_id,
        "created_at": r.created_at.strftime("%Y-%m-%d"),
    }


def booking(b: Booking) -> dict:
    return {
        "id": b.id,
        "barbershop": b.barbershop.name,
        "barbershop_id": b.barbershop_id,
        "address": b.barbershop.address,
        "master": b.master.name,
        "master_id": b.master_id,
        "service": b.service.name,
        "date": b.date,
        "time": b.time,
        "duration": b.duration,
        "price": b.price,
        "client_name": b.client_name,
        "client_phone": b.client_phone,
        "comment": b.comment,
        "status": b.status,
        "created_at": b.created_at.strftime("%Y-%m-%d %H:%M"),
    }


def product(p: Product) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "brand": p.brand,
        "volume": p.volume,
        "price": p.price,
        "short": p.short,
        "description": p.description,
        "usage": p.usage,
        "image": p.image,
        "badge": p.badge,
        "rating": p.rating,
        "reviews_count": p.reviews_count,
        "in_stock": p.stock > 0,
        "category": p.category.name,
        "category_slug": p.category.slug,
    }


def order(o: Order) -> dict:
    return {
        "id": o.id,
        "client_name": o.client_name,
        "client_phone": o.client_phone,
        "delivery": o.delivery,
        "address": o.address,
        "comment": o.comment,
        "delivery_fee": o.delivery_fee,
        "total": o.total,
        "status": o.status,
        "created_at": o.created_at.strftime("%Y-%m-%d %H:%M"),
        "items": [
            {"product_id": i.product_id, "name": i.name, "price": i.price, "qty": i.qty}
            for i in o.items
        ],
    }

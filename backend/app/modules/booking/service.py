"""Бизнес-логика онлайн-записи: расчёт свободных слотов и создание записи."""
from datetime import date, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.accounts.models import User
from app.modules.booking.models import Booking
from app.modules.catalog.models import Barbershop, Master, Service
from app.modules.booking.schemas import BookingIn
from app.shared.presentation import from_minutes, to_minutes

SLOT_STEP = 60          # шаг сетки времени, минут
BOOKING_HORIZON = 30    # на сколько дней вперёд можно записаться
MIN_LEAD_MINUTES = 15   # минимальный запас до начала записи на сегодня
ACTIVE_STATUSES = ("new", "confirmed")


def compute_slots(db: Session, master: Master, day: date, duration: int,
                  now: datetime | None = None, exclude_booking_id: int | None = None) -> list[dict]:
    """Сетка слотов мастера на день с признаком доступности.

    Слот свободен, если услуга целиком помещается в рабочие часы барбершопа,
    не пересекается с активными записями мастера и (для сегодняшнего дня) ещё не прошёл.
    """
    now = now or datetime.now()
    shop = master.barbershop
    open_m, close_m = to_minutes(shop.open_time), to_minutes(shop.close_time)

    busy = [
        (to_minutes(b.time), to_minutes(b.time) + b.duration)
        for b in db.scalars(select(Booking).where(
            Booking.master_id == master.id,
            Booking.date == day.isoformat(),
            Booking.status.in_(ACTIVE_STATUSES),
            Booking.id != exclude_booking_id if exclude_booking_id is not None else True,
        ))
    ]

    earliest = -1
    if day == now.date():
        earliest = now.hour * 60 + now.minute + MIN_LEAD_MINUTES

    slots = []
    start = open_m
    while start + duration <= close_m:
        end = start + duration
        free = start >= earliest and all(end <= b_start or start >= b_end for b_start, b_end in busy)
        slots.append({"time": from_minutes(start), "available": free})
        start += SLOT_STEP
    return slots


def check_day(day: date) -> None:
    today = date.today()
    if day < today or day > today + timedelta(days=BOOKING_HORIZON):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Запись доступна на ближайшие {BOOKING_HORIZON} дней")


def create_booking(db: Session, data: BookingIn, user: User | None) -> Booking:
    lock_master(db, data.master_id)
    shop = db.get(Barbershop, data.barbershop_id)
    master = db.get(Master, data.master_id)
    service = db.get(Service, data.service_id)
    if not shop or not master or not service:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Барбершоп, мастер или услуга не найдены")
    if master.barbershop_id != shop.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Мастер не работает в этом барбершопе")
    check_day(data.date)

    slot = next((s for s in compute_slots(db, master, data.date, service.duration)
                 if s["time"] == data.time), None)
    if slot is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Выбрано недопустимое время")
    if not slot["available"]:
        raise HTTPException(status.HTTP_409_CONFLICT, "Это время уже занято, выберите другое")

    booking = Booking(
        user_id=user.id if user else None,
        barbershop_id=shop.id, master_id=master.id, service_id=service.id,
        date=data.date.isoformat(), time=data.time,
        duration=service.duration, price=service.price,
        client_name=data.client_name.strip(), client_phone=data.client_phone,
        comment=data.comment.strip(),
    )
    db.add(booking)
    try:
        db.commit()
    except IntegrityError:
        # Кто-то занял это же время в ту же долю секунды — база не дала создать дубль.
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Это время уже занято, выберите другое") from None
    db.refresh(booking)
    return booking


def lock_master(db: Session, master_id: int) -> None:
    # UPDATE берёт блокировку до чтения слотов: в SQLite — записи, в PostgreSQL — строки.
    # Это защищает и пересекающиеся услуги с разным временем начала.
    db.execute(update(Master).where(Master.id == master_id)
               .values(id=Master.id))


def restore_booking(db: Session, booking: Booking) -> None:
    lock_master(db, booking.master_id)
    day = date.fromisoformat(booking.date)
    check_day(day)
    slots = compute_slots(db, booking.master, day, booking.duration, exclude_booking_id=booking.id)
    if not any(slot["time"] == booking.time and slot["available"] for slot in slots):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Нельзя восстановить запись: время уже занято или недоступно")

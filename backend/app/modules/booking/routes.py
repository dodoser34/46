"""Онлайн-запись: свободные слоты, создание и отмена записи."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.accounts.models import User
from app.modules.booking.models import Booking
from app.modules.catalog.models import Master, Service
from app.modules.booking.schemas import BookingIn, BookingOut, SlotsOut
from app.shared.dependencies import get_current_user, get_db, get_optional_user
from app.modules.booking import service as booking_service
from app.shared import presentation as ser

router = APIRouter(prefix="/api", tags=["Запись"])


@router.get("/masters/{master_id}/slots", response_model=SlotsOut)
def slots(master_id: int, day: date = Query(alias="date"), service_id: int | None = None,
          db: Session = Depends(get_db)):
    master = db.get(Master, master_id)
    if not master:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Мастер не найден")
    booking_service.check_day(day)
    duration = booking_service.SLOT_STEP
    if service_id is not None:
        service = db.get(Service, service_id)
        if not service:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Услуга не найдена")
        duration = service.duration
    return {"date": day.isoformat(), "slots": booking_service.compute_slots(db, master, day, duration)}


@router.post("/bookings", response_model=BookingOut, status_code=201)
def create_booking(data: BookingIn, db: Session = Depends(get_db),
                   user: User | None = Depends(get_optional_user)):
    return ser.booking(booking_service.create_booking(db, data, user))


@router.get("/me/bookings", response_model=list[BookingOut])
def my_bookings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.scalars(
        select(Booking).where(Booking.user_id == user.id)
        .order_by(Booking.date.desc(), Booking.time.desc())
    )
    return [ser.booking(b) for b in rows]


@router.post("/me/bookings/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(booking_id: int, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    booking = db.get(Booking, booking_id)
    if not booking or booking.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Запись не найдена")
    if booking.status not in booking_service.ACTIVE_STATUSES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Эту запись уже нельзя отменить")
    booking.status = "cancelled"
    db.commit()
    return ser.booking(booking)

"""Онлайн-запись: свободные слоты, создание и отмена записи."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.api.deps import get_current_user, get_db, get_optional_user
from app.services import booking_service, serializers as ser

router = APIRouter(prefix="/api", tags=["Запись"])


@router.get("/masters/{master_id}/slots", response_model=schemas.SlotsOut)
def slots(master_id: int, day: date = Query(alias="date"), service_id: int | None = None,
          db: Session = Depends(get_db)):
    master = db.get(models.Master, master_id)
    if not master:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Мастер не найден")
    booking_service.check_day(day)
    duration = booking_service.SLOT_STEP
    if service_id is not None:
        service = db.get(models.Service, service_id)
        if not service:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Услуга не найдена")
        duration = service.duration
    return {"date": day.isoformat(), "slots": booking_service.compute_slots(db, master, day, duration)}


@router.post("/bookings", response_model=schemas.BookingOut, status_code=201)
def create_booking(data: schemas.BookingIn, db: Session = Depends(get_db),
                   user: models.User | None = Depends(get_optional_user)):
    return ser.booking(booking_service.create_booking(db, data, user))


@router.get("/me/bookings", response_model=list[schemas.BookingOut])
def my_bookings(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    rows = db.scalars(
        select(models.Booking).where(models.Booking.user_id == user.id)
        .order_by(models.Booking.date.desc(), models.Booking.time.desc())
    )
    return [ser.booking(b) for b in rows]


@router.post("/me/bookings/{booking_id}/cancel", response_model=schemas.BookingOut)
def cancel_booking(booking_id: int, db: Session = Depends(get_db),
                   user: models.User = Depends(get_current_user)):
    booking = db.get(models.Booking, booking_id)
    if not booking or booking.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Запись не найдена")
    if booking.status not in booking_service.ACTIVE_STATUSES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Эту запись уже нельзя отменить")
    booking.status = "cancelled"
    db.commit()
    return ser.booking(booking)

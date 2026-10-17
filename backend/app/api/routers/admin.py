"""Панель администратора: записи, заказы, сводка."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.api.deps import get_admin, get_db
from app.services import serializers as ser
from app.services import booking_service, order_service

router = APIRouter(prefix="/api/admin", tags=["Администратор"], dependencies=[Depends(get_admin)])

BOOKING_STATUSES = {"new", "confirmed", "done", "cancelled"}


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    today = date.today().isoformat()
    return {
        "bookings_today": db.scalar(select(func.count(models.Booking.id)).where(
            models.Booking.date == today, models.Booking.status != "cancelled")),
        "bookings_new": db.scalar(select(func.count(models.Booking.id)).where(models.Booking.status == "new")),
        "orders_new": db.scalar(select(func.count(models.Order.id)).where(models.Order.status == "new")),
        "revenue_orders": db.scalar(select(func.coalesce(func.sum(models.Order.total), 0)).where(
            models.Order.status == "done")),
        "users": db.scalar(select(func.count(models.User.id))),
        "subscribers": db.scalar(select(func.count(models.Subscriber.id))),
    }


@router.get("/bookings", response_model=list[schemas.BookingOut])
def bookings(status_filter: str | None = None, day: str | None = None, db: Session = Depends(get_db)):
    stmt = select(models.Booking).order_by(models.Booking.date.desc(), models.Booking.time)
    if status_filter:
        stmt = stmt.where(models.Booking.status == status_filter)
    if day:
        stmt = stmt.where(models.Booking.date == day)
    return [ser.booking(b) for b in db.scalars(stmt)]


@router.patch("/bookings/{booking_id}", response_model=schemas.BookingOut)
def set_booking_status(booking_id: int, data: schemas.StatusIn, db: Session = Depends(get_db)):
    if data.status not in BOOKING_STATUSES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Недопустимый статус")
    booking = db.get(models.Booking, booking_id)
    if not booking:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Запись не найдена")
    if data.status in booking_service.ACTIVE_STATUSES and booking.status not in booking_service.ACTIVE_STATUSES:
        booking_service.restore_booking(db, booking)
    booking.status = data.status
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "На это время у мастера уже есть другая активная запись") from None
    return ser.booking(booking)


@router.get("/orders", response_model=list[schemas.OrderOut])
def orders(db: Session = Depends(get_db)):
    return [ser.order(o) for o in db.scalars(select(models.Order).order_by(models.Order.created_at.desc()))]


@router.patch("/orders/{order_id}", response_model=schemas.OrderOut)
def set_order_status(order_id: int, data: schemas.StatusIn, db: Session = Depends(get_db)):
    return ser.order(order_service.set_status(db, order_id, data.status))

"""Панель администратора: записи, заказы, сводка."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.accounts.models import Subscriber, User
from app.modules.booking.models import Booking
from app.modules.shop.models import Order
from app.modules.booking.schemas import BookingOut, StatusIn
from app.modules.shop.schemas import OrderOut
from app.shared.dependencies import get_admin, get_db
from app.shared import presentation as ser
from app.modules.booking import service as booking_service
from app.modules.shop import service as order_service

router = APIRouter(prefix="/api/admin", tags=["Администратор"], dependencies=[Depends(get_admin)])

BOOKING_STATUSES = {"new", "confirmed", "done", "cancelled"}


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    today = date.today().isoformat()
    return {
        "bookings_today": db.scalar(select(func.count(Booking.id)).where(
            Booking.date == today, Booking.status != "cancelled")),
        "bookings_new": db.scalar(select(func.count(Booking.id)).where(Booking.status == "new")),
        "orders_new": db.scalar(select(func.count(Order.id)).where(Order.status == "new")),
        "revenue_orders": db.scalar(select(func.coalesce(func.sum(Order.total), 0)).where(
            Order.status == "done")),
        "users": db.scalar(select(func.count(User.id))),
        "subscribers": db.scalar(select(func.count(Subscriber.id))),
    }


@router.get("/bookings", response_model=list[BookingOut])
def bookings(status_filter: str | None = None, day: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Booking).order_by(Booking.date.desc(), Booking.time)
    if status_filter:
        stmt = stmt.where(Booking.status == status_filter)
    if day:
        stmt = stmt.where(Booking.date == day)
    return [ser.booking(b) for b in db.scalars(stmt)]


@router.patch("/bookings/{booking_id}", response_model=BookingOut)
def set_booking_status(booking_id: int, data: StatusIn, db: Session = Depends(get_db)):
    if data.status not in BOOKING_STATUSES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Недопустимый статус")
    booking = db.get(Booking, booking_id)
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


@router.get("/orders", response_model=list[OrderOut])
def orders(db: Session = Depends(get_db)):
    return [ser.order(o) for o in db.scalars(select(Order).order_by(Order.created_at.desc()))]


@router.patch("/orders/{order_id}", response_model=OrderOut)
def set_order_status(order_id: int, data: StatusIn, db: Session = Depends(get_db)):
    return ser.order(order_service.set_status(db, order_id, data.status))

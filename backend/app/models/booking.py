"""Записи клиентов к мастерам."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


ACTIVE_SLOT = text("status IN ('new', 'confirmed')")


class Booking(Base):
    __tablename__ = "bookings"
    # Защита от двойной записи на уровне базы: у мастера не может быть двух активных записей
    # с одинаковым началом. Даже если два запроса придут одновременно, второй получит ошибку.
    __table_args__ = (
        Index("uq_bookings_active_slot", "master_id", "date", "time", unique=True,
              sqlite_where=ACTIVE_SLOT, postgresql_where=ACTIVE_SLOT),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    barbershop_id: Mapped[int] = mapped_column(ForeignKey("barbershops.id"))
    master_id: Mapped[int] = mapped_column(ForeignKey("masters.id"))
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"))
    date: Mapped[str] = mapped_column(String(10), index=True)  # "2026-10-16"
    time: Mapped[str] = mapped_column(String(5))               # "13:00"
    duration: Mapped[int] = mapped_column(Integer)
    price: Mapped[int] = mapped_column(Integer)
    client_name: Mapped[str] = mapped_column(String(100))
    client_phone: Mapped[str] = mapped_column(String(30))
    comment: Mapped[str] = mapped_column(Text, default="")
    # new — новая, confirmed — подтверждена, done — выполнена, cancelled — отменена
    status: Mapped[str] = mapped_column(String(20), default="new")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    barbershop: Mapped["Barbershop"] = relationship()
    master: Mapped["Master"] = relationship()
    service: Mapped["Service"] = relationship()

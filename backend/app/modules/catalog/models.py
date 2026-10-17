"""Города, барбершопы, услуги, мастера и отзывы."""
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class City(Base):
    __tablename__ = "cities"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), unique=True)
    slug: Mapped[str] = mapped_column(String(60), unique=True)


class Barbershop(Base):
    __tablename__ = "barbershops"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    city_id: Mapped[int] = mapped_column(ForeignKey("cities.id"))
    address: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(30))
    open_time: Mapped[str] = mapped_column(String(5))   # "10:00"
    close_time: Mapped[str] = mapped_column(String(5))  # "22:00"
    description: Mapped[str] = mapped_column(Text)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    rating: Mapped[float] = mapped_column(Float, default=5.0)
    reviews_count: Mapped[int] = mapped_column(Integer, default=0)
    images: Mapped[str] = mapped_column(Text)  # пути через запятую, первый — обложка

    city: Mapped[City] = relationship()
    masters: Mapped[list["Master"]] = relationship(back_populates="barbershop")


class Service(Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str] = mapped_column(Text)
    price: Mapped[int] = mapped_column(Integer)
    duration: Mapped[int] = mapped_column(Integer)  # минуты
    image: Mapped[str] = mapped_column(String(200))
    sort: Mapped[int] = mapped_column(Integer, default=0)


class Master(Base):
    __tablename__ = "masters"

    id: Mapped[int] = mapped_column(primary_key=True)
    barbershop_id: Mapped[int] = mapped_column(ForeignKey("barbershops.id"))
    name: Mapped[str] = mapped_column(String(100))
    title: Mapped[str] = mapped_column(String(100))
    experience: Mapped[int] = mapped_column(Integer)  # лет
    bio: Mapped[str] = mapped_column(Text)
    specializations: Mapped[str] = mapped_column(String(200))  # через запятую
    photo: Mapped[str] = mapped_column(String(200))
    works: Mapped[str] = mapped_column(Text)  # пути через запятую
    rating: Mapped[float] = mapped_column(Float, default=5.0)
    reviews_count: Mapped[int] = mapped_column(Integer, default=0)

    barbershop: Mapped[Barbershop] = relationship(back_populates="masters")


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    barbershop_id: Mapped[int] = mapped_column(ForeignKey("barbershops.id"))
    master_id: Mapped[int | None] = mapped_column(ForeignKey("masters.id"), nullable=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    author: Mapped[str] = mapped_column(String(100))
    rating: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

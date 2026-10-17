"""Интеграционные тесты основных сценариев API."""
from datetime import date, timedelta

TOMORROW = (date.today() + timedelta(days=1)).isoformat()


# ---------- Авторизация ----------

def test_register_login_and_me(client):
    r = client.post("/api/auth/register", json={
        "name": "Тест", "email": "test@example.com", "phone": "+7 777 123 45 67", "password": "secret1"})
    assert r.status_code == 201
    token = r.json()["token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["email"] == "test@example.com"

    dup = client.post("/api/auth/register", json={"name": "Тест", "email": "test@example.com", "password": "secret1"})
    assert dup.status_code == 409


def test_wrong_password(client):
    r = client.post("/api/auth/login", json={"email": "demo@barber.kz", "password": "nope"})
    assert r.status_code == 401


def test_me_requires_auth(client):
    assert client.get("/api/auth/me").status_code == 401


# ---------- Каталог ----------

def test_barbershops_filter_by_city(client):
    shops = client.get("/api/barbershops", params={"city": "almaty"}).json()
    assert len(shops) == 4
    assert all(s["city"] == "Алматы" for s in shops)
    ratings = [s["rating"] for s in shops]
    assert ratings == sorted(ratings, reverse=True)


def test_barbershops_sort_by_distance(client):
    shops = client.get("/api/barbershops", params={"sort": "distance", "lat": 53.21, "lng": 63.62}).json()
    assert shops[0]["slug"] == "blind-barber"


def test_barbershop_detail_has_masters(client):
    shop = client.get("/api/barbershops/1").json()
    assert shop["masters"] and len(shop["images"]) == 3
    assert client.get("/api/barbershops/999").status_code == 404


def test_favorite_toggle(client, user_headers):
    assert client.post("/api/barbershops/2/favorite", headers=user_headers).json()["is_favorite"] is True
    favs = client.get("/api/barbershops", params={"favorites": True}, headers=user_headers).json()
    assert [s["id"] for s in favs] == [2]
    assert client.post("/api/barbershops/2/favorite", headers=user_headers).json()["is_favorite"] is False


def test_review_updates_rating(client, user_headers):
    before = client.get("/api/barbershops/3").json()["reviews_count"]
    r = client.post("/api/barbershops/3/reviews", headers=user_headers, json={"rating": 5, "text": "Отлично!"})
    assert r.status_code == 201
    assert client.get("/api/barbershops/3").json()["reviews_count"] == before + 1


# ---------- Запись ----------

def test_slots_mark_existing_bookings_busy(client):
    slots = client.get("/api/masters/1/slots", params={"date": TOMORROW, "service_id": 1}).json()["slots"]
    busy = {s["time"] for s in slots if not s["available"]}
    assert "13:00" in busy  # запись из демо-данных


def test_booking_and_double_booking(client):
    payload = {"barbershop_id": 1, "master_id": 2, "service_id": 1, "date": TOMORROW, "time": "18:00",
               "client_name": "Иван", "client_phone": "+7 701 000 00 01"}
    first = client.post("/api/bookings", json=payload)
    assert first.status_code == 201, first.text
    assert first.json()["price"] == 12000
    second = client.post("/api/bookings", json=payload)
    assert second.status_code == 409


def test_booking_validation(client):
    base = {"barbershop_id": 1, "master_id": 3, "service_id": 1, "date": TOMORROW, "time": "12:00",
            "client_name": "Иван", "client_phone": "+7 701 000 00 01"}
    assert client.post("/api/bookings", json=base).status_code == 400  # мастер из другого барбершопа
    assert client.post("/api/bookings", json={**base, "master_id": 1, "client_phone": "123"}).status_code == 422
    past = (date.today() - timedelta(days=1)).isoformat()
    assert client.post("/api/bookings", json={**base, "master_id": 1, "date": past}).status_code == 400


def test_user_can_cancel_own_booking(client, user_headers):
    payload = {"barbershop_id": 1, "master_id": 1, "service_id": 3, "date": TOMORROW, "time": "19:00",
               "client_name": "Демо", "client_phone": "+7 701 111 22 33"}
    booking = client.post("/api/bookings", json=payload, headers=user_headers).json()
    r = client.post(f"/api/me/bookings/{booking['id']}/cancel", headers=user_headers)
    assert r.json()["status"] == "cancelled"
    # после отмены слот снова свободен
    slots = client.get("/api/masters/1/slots", params={"date": TOMORROW, "service_id": 3}).json()["slots"]
    assert next(s for s in slots if s["time"] == "19:00")["available"]


# ---------- Магазин ----------

def test_products_filter_and_sort(client):
    items = client.get("/api/products", params={"category": "styling", "sort": "price_asc"}).json()
    assert items and all(p["category_slug"] == "styling" for p in items)
    prices = [p["price"] for p in items]
    assert prices == sorted(prices)


def test_order_uses_server_prices(client):
    product = client.get("/api/products/3").json()
    r = client.post("/api/orders", json={
        "items": [{"product_id": 3, "qty": 2}], "client_name": "Иван",
        "client_phone": "+7 701 000 00 01", "delivery": "pickup"})
    assert r.status_code == 201
    assert r.json()["total"] == product["price"] * 2


def test_courier_requires_address(client):
    r = client.post("/api/orders", json={
        "items": [{"product_id": 1, "qty": 1}], "client_name": "Иван",
        "client_phone": "+7 701 000 00 01", "delivery": "courier"})
    assert r.status_code == 400


# ---------- Администратор ----------

def test_admin_access(client, user_headers, admin_headers):
    assert client.get("/api/admin/summary", headers=user_headers).status_code == 403
    bookings = client.get("/api/admin/bookings", headers=admin_headers).json()
    r = client.patch(f"/api/admin/bookings/{bookings[0]['id']}", headers=admin_headers, json={"status": "done"})
    assert r.json()["status"] == "done"


def test_courier_delivery_fee(client):
    r = client.post("/api/orders", json={
        "items": [{"product_id": 9, "qty": 1}], "client_name": "Иван",
        "client_phone": "+7 701 000 00 01", "delivery": "courier", "address": "ул. Абая 1, кв. 5"})
    assert r.status_code == 201
    body = r.json()
    assert body["delivery_fee"] == 1500
    assert body["total"] == 6000 + 1500


# ---------- Готовность к деплою ----------

def test_health_checks_database(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "database": "ok"}


def test_security_headers(client):
    r = client.get("/")
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "SAMEORIGIN"
    assert r.headers["Cache-Control"] == "no-cache"


def test_login_rate_limit(client):
    payload = {"email": "brute@example.com", "password": "wrong-pass"}
    codes = [client.post("/api/auth/login", json=payload).status_code for _ in range(9)]
    assert codes[:8] == [401] * 8
    assert codes[8] == 429


def test_expired_token_is_rejected(client):
    from datetime import datetime, timedelta

    from app import models
    from app.core.database import SessionLocal

    token = client.post("/api/auth/login", json={"email": "demo@barber.kz", "password": "demo123"}).json()["token"]
    with SessionLocal() as db:
        row = db.get(models.AuthToken, token)
        row.created_at = datetime.now() - timedelta(days=365)
        db.commit()
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_database_blocks_duplicate_active_slot():
    """Даже в обход API база не даст создать две активные записи на одно время у мастера."""
    import pytest
    from sqlalchemy.exc import IntegrityError

    from app import models
    from app.core.database import SessionLocal

    day = (date.today() + timedelta(days=5)).isoformat()
    base = dict(barbershop_id=1, master_id=1, service_id=1, date=day, time="10:00", duration=60,
                price=12000, client_name="Тест", client_phone="+7 700 000 00 00")
    with SessionLocal() as db:
        db.add(models.Booking(**base, status="new"))
        db.commit()
        db.add(models.Booking(**base, status="cancelled"))  # отменённая не мешает
        db.commit()
        db.add(models.Booking(**base, status="confirmed"))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()


def test_manage_create_admin_and_set_password(client):
    import argparse

    from app import manage

    manage.cmd_create_admin(argparse.Namespace(email="boss@example.com", password="SuperSecret1", name="Босс"))
    r = client.post("/api/auth/login", json={"email": "boss@example.com", "password": "SuperSecret1"})
    assert r.json()["user"]["is_admin"] is True
    manage.cmd_set_password(argparse.Namespace(email="boss@example.com", password="NewSecret22"))
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {r.json()['token']}"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "boss@example.com", "password": "NewSecret22"}).status_code == 200


def test_production_requires_admin_password(monkeypatch):
    import pytest

    from app.core.config import settings

    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "admin_password", "admin123")
    with pytest.raises(RuntimeError):
        settings.check_production()
    monkeypatch.setattr(settings, "admin_password", "Very-Strong-Password-2026")
    settings.check_production()

"""Регрессии полных сценариев: склад, статусы, выручка и пересекающиеся записи."""
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

import pytest

from app import models
from app.core.database import SessionLocal


def order_payload(product=1, qty=1):
    return {"items": [{"product_id": product, "qty": qty}], "client_name": "Проверка",
            "client_phone": "+7 701 000 00 00", "delivery": "pickup"}


def stock(product=1):
    with SessionLocal() as db:
        return db.get(models.Product, product).stock


def test_cancellation_returns_stock_once_and_reopening_reserves_again(client, admin_headers):
    before = stock()
    order = client.post('/api/orders', json=order_payload(qty=2)).json()
    endpoint = f"/api/admin/orders/{order['id']}"
    assert stock() == before - 2
    for _ in range(2):
        assert client.patch(endpoint, headers=admin_headers, json={"status": "cancelled"}).status_code == 200
        assert stock() == before
    assert client.patch(endpoint, headers=admin_headers, json={"status": "processing"}).status_code == 200
    assert stock() == before - 2
    client.patch(endpoint, headers=admin_headers, json={"status": "cancelled"})


def test_cannot_reopen_order_when_stock_has_run_out(client, admin_headers):
    order = client.post('/api/orders', json=order_payload()).json()
    endpoint = f"/api/admin/orders/{order['id']}"
    client.patch(endpoint, headers=admin_headers, json={"status": "cancelled"})
    before = stock()
    with SessionLocal() as db:
        db.get(models.Product, 1).stock = 0
        db.commit()
    try:
        assert client.patch(endpoint, headers=admin_headers, json={"status": "new"}).status_code == 409
        with SessionLocal() as db:
            assert db.get(models.Order, order['id']).status == 'cancelled'
        assert stock() == 0
    finally:
        with SessionLocal() as db:
            db.get(models.Product, 1).stock = before
            db.commit()


def test_revenue_counts_only_completed_orders(client, admin_headers):
    before = client.get('/api/admin/summary', headers=admin_headers).json()['revenue_orders']
    order = client.post('/api/orders', json=order_payload()).json()
    endpoint = f"/api/admin/orders/{order['id']}"
    assert client.get('/api/admin/summary', headers=admin_headers).json()['revenue_orders'] == before
    client.patch(endpoint, headers=admin_headers, json={"status": "done"})
    assert client.get('/api/admin/summary', headers=admin_headers).json()['revenue_orders'] == before + order['total']
    client.patch(endpoint, headers=admin_headers, json={"status": "cancelled"})
    assert client.get('/api/admin/summary', headers=admin_headers).json()['revenue_orders'] == before


def test_order_failure_rolls_back_all_reserved_items(client):
    before = stock()
    payload = order_payload()
    payload['items'].append({"product_id": 999999, "qty": 1})
    assert client.post('/api/orders', json=payload).status_code == 404
    assert stock() == before


def test_duplicate_lines_cannot_bypass_quantity_limit(client):
    before = stock()
    payload = order_payload(qty=20)
    payload['items'].append({"product_id": 1, "qty": 1})
    assert client.post('/api/orders', json=payload).status_code == 400
    assert stock() == before


def test_concurrent_orders_cannot_sell_the_same_last_item(client):
    before = stock()
    with SessionLocal() as db:
        db.get(models.Product, 1).stock = 1
        db.commit()
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: client.post('/api/orders', json=order_payload()), range(2)))
        assert sorted(r.status_code for r in results) == [201, 409]
        assert stock() == 0
    finally:
        with SessionLocal() as db:
            db.get(models.Product, 1).stock = before
            db.commit()


def booking_payload(day, time='10:00', service=2):
    return {"barbershop_id": 6, "master_id": 11, "service_id": service, "date": day, "time": time,
            "client_name": "Проверка", "client_phone": "+7 701 000 00 00"}


def test_restoring_cancelled_booking_checks_full_duration(client, admin_headers):
    day = (date.today() + timedelta(days=9)).isoformat()
    first = client.post('/api/bookings', json=booking_payload(day)).json()
    endpoint = f"/api/admin/bookings/{first['id']}"
    client.patch(endpoint, headers=admin_headers, json={"status": "cancelled"})
    assert client.post('/api/bookings', json=booking_payload(day, '11:00', 1)).status_code == 201
    assert client.patch(endpoint, headers=admin_headers, json={"status": "confirmed"}).status_code == 409


def test_concurrent_bookings_with_different_starts_cannot_overlap(client):
    day = (date.today() + timedelta(days=10)).isoformat()
    payloads = [booking_payload(day), booking_payload(day, '11:00', 1)]
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda payload: client.post('/api/bookings', json=payload), payloads))
    assert sorted(r.status_code for r in results) == [201, 409]


@pytest.mark.parametrize('kind', ['register', 'profile', 'order', 'booking', 'review'])
def test_whitespace_only_fields_are_rejected(client, user_headers, kind):
    if kind == 'register':
        response = client.post('/api/auth/register', json={
            'name': '   ', 'email': 'blank@example.com', 'password': 'secret123'})
    elif kind == 'profile':
        response = client.patch('/api/auth/me', headers=user_headers, json={'name': '  '})
    elif kind == 'order':
        response = client.post('/api/orders', json={**order_payload(), 'client_name': '   '})
    elif kind == 'booking':
        day = (date.today() + timedelta(days=2)).isoformat()
        response = client.post('/api/bookings', json={**booking_payload(day), 'client_name': '   '})
    else:
        response = client.post('/api/barbershops/1/reviews', headers=user_headers,
                               json={'rating': 5, 'text': '      '})
    assert response.status_code == 422


def test_custom_404_does_not_replace_api_errors(client):
    response = client.get('/missing-page')
    assert response.status_code == 404
    assert 'text/html' in response.headers['content-type']
    assert 'Blind Barber' in response.text
    response = client.get('/api/missing-endpoint')
    assert response.status_code == 404
    assert response.headers['content-type'] == 'application/json'

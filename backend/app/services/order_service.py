"""Бизнес-логика оформления заказа в магазине."""
from fastapi import HTTPException, status
from sqlalchemy import update
from sqlalchemy.orm import Session

from app import models, schemas

DELIVERY_FEE = 1500          # курьерская доставка по городу, ₸
FREE_DELIVERY_FROM = 30000   # бесплатная доставка от суммы, ₸


def delivery_fee(delivery: str, subtotal: int) -> int:
    if delivery != "courier" or subtotal >= FREE_DELIVERY_FROM:
        return 0
    return DELIVERY_FEE


def create_order(db: Session, data: schemas.OrderIn, user: models.User | None) -> models.Order:
    if data.delivery == "courier" and len(data.address.strip()) < 5:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Укажите адрес доставки")

    # Цены и наличие берём только из базы — данным корзины с клиента не доверяем.
    order = models.Order(
        user_id=user.id if user else None, client_name=data.client_name.strip(),
        client_phone=data.client_phone, delivery=data.delivery,
        address=data.address.strip() if data.delivery == "courier" else "",
        comment=data.comment.strip(), total=0,
    )
    merged: dict[int, int] = {}
    for item in data.items:
        merged[item.product_id] = merged.get(item.product_id, 0) + item.qty

    total = 0
    for product_id, qty in sorted(merged.items()):
        product = db.get(models.Product, product_id)
        if not product:
            db.rollback()
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Товар #{product_id} не найден")
        if qty > 20:
            db.rollback()
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Не больше 20 единиц одного товара в заказе")
        reserved = db.execute(update(models.Product).where(
            models.Product.id == product_id, models.Product.stock >= qty,
        ).values(stock=models.Product.stock - qty).execution_options(synchronize_session=False))
        if reserved.rowcount != 1:
            name, stock = product.name, product.stock
            db.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT,
                                f"«{name}»: в наличии только {stock} шт.")
        order.items.append(models.OrderItem(product_id=product.id, name=product.name,
                                            price=product.price, qty=qty))
        total += product.price * qty
    order.delivery_fee = delivery_fee(data.delivery, total)
    order.total = total + order.delivery_fee

    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def set_status(db: Session, order_id: int, next_status: str) -> models.Order:
    """Отмена возвращает остатки один раз; восстановление повторно резервирует товары."""
    if next_status not in {"new", "processing", "done", "cancelled"}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Недопустимый статус")
    order = db.get(models.Order, order_id)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Заказ не найден")
    previous = order.status
    if previous == next_status:
        return order
    changed = db.execute(update(models.Order).where(
        models.Order.id == order_id, models.Order.status == previous,
    ).values(status=next_status).execution_options(synchronize_session=False))
    if changed.rowcount != 1:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Заказ уже изменён. Обновите страницу")
    for item in sorted(order.items, key=lambda row: row.product_id):
        if next_status == "cancelled":
            db.execute(update(models.Product).where(models.Product.id == item.product_id)
                       .values(stock=models.Product.stock + item.qty))
        elif previous == "cancelled":
            reserved = db.execute(update(models.Product).where(
                models.Product.id == item.product_id, models.Product.stock >= item.qty,
            ).values(stock=models.Product.stock - item.qty))
            if reserved.rowcount != 1:
                db.rollback()
                raise HTTPException(status.HTTP_409_CONFLICT,
                                    "Нельзя восстановить заказ: недостаточно товара на складе")
    db.commit()
    db.refresh(order)
    return order

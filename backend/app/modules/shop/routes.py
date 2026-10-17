"""Интернет-магазин: категории, товары, оформление заказа."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.modules.accounts.models import User
from app.modules.shop.models import Order, Product, ProductCategory
from app.modules.shop.schemas import CategoryOut, OrderIn, OrderOut, ProductOut
from app.shared.dependencies import get_current_user, get_db, get_optional_user
from app.modules.shop import service as order_service
from app.shared import presentation as ser

router = APIRouter(prefix="/api", tags=["Магазин"])


@router.get("/categories", response_model=list[CategoryOut])
def categories(db: Session = Depends(get_db)):
    return db.scalars(select(ProductCategory).order_by(ProductCategory.sort)).all()


@router.get("/products", response_model=list[ProductOut])
def products(
    category: str | None = None,
    q: str | None = Query(None, max_length=100),
    sort: str = Query("popular", pattern="^(popular|price_asc|price_desc|rating)$"),
    ids: str | None = Query(None, description="список id через запятую"),
    db: Session = Depends(get_db),
):
    stmt = select(Product).join(ProductCategory)
    if category:
        stmt = stmt.where(ProductCategory.slug == category)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Product.name.ilike(like), Product.brand.ilike(like),
                              Product.short.ilike(like)))
    if ids:
        id_list = [int(x) for x in ids.split(",") if x.strip().isdigit()]
        stmt = stmt.where(Product.id.in_(id_list))
    order = {
        "price_asc": Product.price.asc(),
        "price_desc": Product.price.desc(),
        "rating": Product.rating.desc(),
        "popular": Product.reviews_count.desc(),
    }[sort]
    return [ser.product(p) for p in db.scalars(stmt.order_by(order))]


@router.get("/products/{product_id}", response_model=ProductOut)
def product(product_id: int, db: Session = Depends(get_db)):
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Товар не найден")
    return ser.product(p)


@router.post("/orders", response_model=OrderOut, status_code=201)
def create_order(data: OrderIn, db: Session = Depends(get_db),
                 user: User | None = Depends(get_optional_user)):
    return ser.order(order_service.create_order(db, data, user))


@router.get("/me/orders", response_model=list[OrderOut])
def my_orders(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.scalars(select(Order).where(Order.user_id == user.id)
                      .order_by(Order.created_at.desc()))
    return [ser.order(o) for o in rows]

"""Интернет-магазин: категории, товары, оформление заказа."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app import models, schemas
from app.api.deps import get_current_user, get_db, get_optional_user
from app.services import order_service, serializers as ser

router = APIRouter(prefix="/api", tags=["Магазин"])


@router.get("/categories", response_model=list[schemas.CategoryOut])
def categories(db: Session = Depends(get_db)):
    return db.scalars(select(models.ProductCategory).order_by(models.ProductCategory.sort)).all()


@router.get("/products", response_model=list[schemas.ProductOut])
def products(
    category: str | None = None,
    q: str | None = Query(None, max_length=100),
    sort: str = Query("popular", pattern="^(popular|price_asc|price_desc|rating)$"),
    ids: str | None = Query(None, description="список id через запятую"),
    db: Session = Depends(get_db),
):
    stmt = select(models.Product).join(models.ProductCategory)
    if category:
        stmt = stmt.where(models.ProductCategory.slug == category)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(models.Product.name.ilike(like), models.Product.brand.ilike(like),
                              models.Product.short.ilike(like)))
    if ids:
        id_list = [int(x) for x in ids.split(",") if x.strip().isdigit()]
        stmt = stmt.where(models.Product.id.in_(id_list))
    order = {
        "price_asc": models.Product.price.asc(),
        "price_desc": models.Product.price.desc(),
        "rating": models.Product.rating.desc(),
        "popular": models.Product.reviews_count.desc(),
    }[sort]
    return [ser.product(p) for p in db.scalars(stmt.order_by(order))]


@router.get("/products/{product_id}", response_model=schemas.ProductOut)
def product(product_id: int, db: Session = Depends(get_db)):
    p = db.get(models.Product, product_id)
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Товар не найден")
    return ser.product(p)


@router.post("/orders", response_model=schemas.OrderOut, status_code=201)
def create_order(data: schemas.OrderIn, db: Session = Depends(get_db),
                 user: models.User | None = Depends(get_optional_user)):
    return ser.order(order_service.create_order(db, data, user))


@router.get("/me/orders", response_model=list[schemas.OrderOut])
def my_orders(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    rows = db.scalars(select(models.Order).where(models.Order.user_id == user.id)
                      .order_by(models.Order.created_at.desc()))
    return [ser.order(o) for o in rows]

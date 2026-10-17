"""Города, услуги, барбершопы, мастера, отзывы и избранное."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.modules.accounts.models import Favorite, Subscriber, User
from app.modules.booking.models import Booking
from app.modules.catalog.models import Barbershop, City, Master, Review, Service
from app.modules.catalog.schemas import BarbershopOut, BarbershopShort, CityOut, MasterOut, ReviewIn, ReviewOut, ServiceOut
from app.modules.shop.schemas import SubscribeIn
from app.shared.dependencies import get_current_user, get_db, get_optional_user
from app.shared import presentation as ser

router = APIRouter(prefix="/api", tags=["Каталог"])


def _favorite_ids(db: Session, user: User | None) -> set[int]:
    if not user:
        return set()
    rows = db.scalars(select(Favorite.barbershop_id).where(Favorite.user_id == user.id))
    return set(rows)


def _get_shop(db: Session, shop_id: int) -> Barbershop:
    shop = db.get(Barbershop, shop_id)
    if not shop:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Барбершоп не найден")
    return shop


@router.get("/cities", response_model=list[CityOut])
def cities(db: Session = Depends(get_db)):
    return db.scalars(select(City).order_by(City.id)).all()


@router.get("/services", response_model=list[ServiceOut])
def services(db: Session = Depends(get_db)):
    return db.scalars(select(Service).order_by(Service.sort)).all()


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    return {
        "barbershops": db.scalar(select(func.count(Barbershop.id))),
        "masters": db.scalar(select(func.count(Master.id))),
        "bookings": db.scalar(select(func.count(Booking.id))),
        "cities": db.scalar(select(func.count(City.id))),
    }


@router.get("/barbershops", response_model=list[BarbershopShort])
def barbershops(
    city: str | None = Query(None, description="slug города"),
    q: str | None = Query(None, max_length=100),
    sort: str = Query("rating", pattern="^(rating|distance|name)$"),
    open_now: bool = False,
    favorites: bool = False,
    lat: float | None = None,
    lng: float | None = None,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    stmt = select(Barbershop).join(City)
    if city:
        stmt = stmt.where(City.slug == city)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Barbershop.name.ilike(like), Barbershop.address.ilike(like)))
    fav = _favorite_ids(db, user)
    shops = list(db.scalars(stmt).all())
    if favorites:
        shops = [s for s in shops if s.id in fav]
    if open_now:
        shops = [s for s in shops if ser.is_open_now(s)]

    origin = (lat, lng) if lat is not None and lng is not None else None
    items = [ser.barbershop_short(s, fav, origin) for s in shops]
    if sort == "distance" and origin:
        items.sort(key=lambda s: s["distance_km"])
    elif sort == "name":
        items.sort(key=lambda s: s["name"])
    else:
        items.sort(key=lambda s: (-s["rating"], -s["reviews_count"]))
    return items


@router.get("/barbershops/{shop_id}", response_model=BarbershopOut)
def barbershop(shop_id: int, db: Session = Depends(get_db),
               user: User | None = Depends(get_optional_user)):
    return ser.barbershop_full(_get_shop(db, shop_id), _favorite_ids(db, user))


@router.get("/barbershops/{shop_id}/reviews", response_model=list[ReviewOut])
def shop_reviews(shop_id: int, db: Session = Depends(get_db)):
    _get_shop(db, shop_id)
    rows = db.scalars(
        select(Review).where(Review.barbershop_id == shop_id)
        .order_by(Review.created_at.desc())
    )
    return [ser.review(r) for r in rows]


@router.post("/barbershops/{shop_id}/reviews", response_model=ReviewOut, status_code=201)
def add_review(shop_id: int, data: ReviewIn, db: Session = Depends(get_db),
               user: User = Depends(get_current_user)):
    shop = _get_shop(db, shop_id)
    master = None
    if data.master_id is not None:
        master = db.get(Master, data.master_id)
        if not master or master.barbershop_id != shop.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Мастер не работает в этом барбершопе")

    review = Review(barbershop_id=shop.id, master_id=data.master_id, user_id=user.id,
                           author=user.name, rating=data.rating, text=data.text.strip())
    db.add(review)
    # Пересчитываем средний рейтинг с учётом нового отзыва.
    shop.rating = round((shop.rating * shop.reviews_count + data.rating) / (shop.reviews_count + 1), 1)
    shop.reviews_count += 1
    if master:
        master.rating = round((master.rating * master.reviews_count + data.rating) / (master.reviews_count + 1), 1)
        master.reviews_count += 1
    db.commit()
    return ser.review(review)


@router.get("/masters/{master_id}", response_model=MasterOut)
def master(master_id: int, db: Session = Depends(get_db)):
    m = db.get(Master, master_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Мастер не найден")
    return ser.master_full(m)


@router.get("/masters/{master_id}/reviews", response_model=list[ReviewOut])
def master_reviews(master_id: int, db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Review).where(Review.master_id == master_id)
        .order_by(Review.created_at.desc())
    )
    return [ser.review(r) for r in rows]


@router.post("/barbershops/{shop_id}/favorite")
def toggle_favorite(shop_id: int, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    _get_shop(db, shop_id)
    row = db.scalar(select(Favorite).where(
        Favorite.user_id == user.id, Favorite.barbershop_id == shop_id))
    if row:
        db.delete(row)
        db.commit()
        return {"is_favorite": False}
    db.add(Favorite(user_id=user.id, barbershop_id=shop_id))
    db.commit()
    return {"is_favorite": True}


@router.post("/subscribe", status_code=201)
def subscribe(data: SubscribeIn, db: Session = Depends(get_db)):
    email = data.email.lower()
    if not db.scalar(select(Subscriber).where(Subscriber.email == email)):
        db.add(Subscriber(email=email))
        db.commit()
    return {"ok": True, "message": "Вы подписаны на новости"}

"""Начальное наполнение базы демонстрационными данными."""
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.core.config import settings
from app.core.security import hash_password

from .data import CATEGORIES, CITIES, IMG, MASTERS, PRODUCTS, REVIEW_TEXTS, SERVICES, SHOPS


def seed(db: Session) -> None:
    if db.scalar(select(models.City.id).limit(1)):
        return

    cities = {slug: models.City(name=name, slug=slug) for name, slug in CITIES}
    db.add_all(cities.values())

    services = []
    for i, (name, slug, desc, price, duration) in enumerate(SERVICES):
        services.append(models.Service(name=name, slug=slug, description=desc, price=price,
                                       duration=duration, image=f"{IMG}/services/{slug}.jpg", sort=i))
    db.add_all(services)

    shops: dict[str, models.Barbershop] = {}
    for (name, slug, city, address, phone, o, c, lat, lng, rating, reviews, desc) in SHOPS:
        images = ",".join(f"{IMG}/shops/{slug}-{n}.jpg" for n in (1, 2, 3))
        shop = models.Barbershop(
            name=name, slug=slug, city=cities[city], address=address, phone=phone,
            open_time=o, close_time=c, description=desc,
            lat=lat, lng=lng, rating=rating, reviews_count=reviews, images=images,
        )
        shops[slug] = shop
        db.add(shop)

    masters = []
    n = 0
    for shop_slug, items in MASTERS.items():
        for (name, title, exp, specs, bio) in items:
            n += 1
            works = ",".join(f"{IMG}/works/work-{(n + k) % 9 + 1}.jpg" for k in range(3))
            m = models.Master(
                barbershop=shops[shop_slug], name=name, title=title, experience=exp, bio=bio,
                specializations=specs, photo=f"{IMG}/masters/master-{n}.jpg", works=works,
                rating=round(4.7 + (n % 3) * 0.1, 1), reviews_count=40 + n * 11,
            )
            masters.append(m)
            db.add(m)
    db.flush()

    for i, shop in enumerate(shops.values()):
        shop_masters = [m for m in masters if m.barbershop_id == shop.id]
        for j, (author, rating, text) in enumerate(REVIEW_TEXTS[i % 2: i % 2 + 4]):
            db.add(models.Review(
                barbershop_id=shop.id, master_id=shop_masters[j % len(shop_masters)].id,
                author=author, rating=rating, text=text,
                created_at=datetime.now() - timedelta(days=3 + i * 2 + j * 5),
            ))

    categories = {}
    for i, (name, slug) in enumerate(CATEGORIES):
        categories[slug] = models.ProductCategory(name=name, slug=slug, sort=i)
        db.add(categories[slug])
    for (cat, name, brand, vol, price, badge, rating, reviews, stock, img, short, desc, usage) in PRODUCTS:
        db.add(models.Product(
            category=categories[cat], name=name, brand=brand, volume=vol, price=price, badge=badge,
            rating=rating, reviews_count=reviews, stock=stock, image=f"{IMG}/products/{img}.jpg",
            short=short, description=desc, usage=usage,
        ))

    admin = models.User(name="Администратор", email=settings.admin_email, phone="+7 700 000 00 00",
                        password_hash=hash_password(settings.admin_password), is_admin=True)
    demo = models.User(name="Демо Пользователь", email="demo@barber.kz", phone="+7 701 111 22 33",
                       password_hash=hash_password("demo123"))
    db.add_all([admin, demo])
    db.flush()

    # Несколько записей, чтобы в расписании были занятые слоты.
    service_by_slug = {s.slug: s for s in services}
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    for master, time, slug in [(masters[0], "13:00", "haircut"), (masters[0], "16:00", "haircut-beard"),
                               (masters[1], "12:00", "fade"), (masters[10], "14:00", "haircut")]:
        s = service_by_slug[slug]
        db.add(models.Booking(
            user_id=demo.id, barbershop_id=master.barbershop_id, master_id=master.id, service_id=s.id,
            date=tomorrow, time=time, duration=s.duration, price=s.price,
            client_name=demo.name, client_phone=demo.phone, status="confirmed",
        ))
    db.commit()

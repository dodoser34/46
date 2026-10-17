"""Export public seed data for GitHub Pages, never the local application database.

Usage: python scripts/pages/export_demo.py --output dist/data/demo.json
The exporter deliberately replaces app.core.config before importing the app: it
does not read backend/.env, DATABASE_URL, or existing customer data.
"""
from __future__ import annotations

import argparse
import json
import sys
import tempfile
from datetime import date
from pathlib import Path
from types import ModuleType, SimpleNamespace


def export_demo(output: Path) -> dict:
    backend = Path(__file__).resolve().parents[2] / "backend"
    sys.path.insert(0, str(backend))
    if "app.core.config" in sys.modules:
        raise RuntimeError("Run the exporter in its own Python process for isolated settings")

    with tempfile.TemporaryDirectory(prefix="blind-barber-pages-") as directory:
        config = ModuleType("app.core.config")
        config.settings = SimpleNamespace(
            is_sqlite=True,
            database_url=f"sqlite:///{Path(directory, 'seed.db').as_posix()}",
            admin_email="admin@barber.kz",
            admin_password="admin123",
        )
        sys.modules["app.core.config"] = config

        from sqlalchemy import select
        from app import models, schemas
        from app.core.database import Base, SessionLocal, engine
        from app.seed.seed import seed
        from app.services import serializers as ser

        try:
            Base.metadata.create_all(engine)
            with SessionLocal() as db:
                seed(db)
                rows = lambda model: db.scalars(select(model).order_by(model.id)).all()
                payload = {
                    "version": 1,
                    "notice": "Public browser-only demo. No real bookings, orders, payments or messages.",
                    "cities": [schemas.CityOut.model_validate(c).model_dump() for c in rows(models.City)],
                    "services": [schemas.ServiceOut.model_validate(s).model_dump() for s in rows(models.Service)],
                    "barbershops": [
                        {**ser.barbershop_full(s), "city_slug": s.city.slug} for s in rows(models.Barbershop)
                    ],
                    "masters": [ser.master_full(m) for m in rows(models.Master)],
                    "reviews": [{**ser.review(r), "barbershop_id": r.barbershop_id} for r in rows(models.Review)],
                    "categories": [schemas.CategoryOut.model_validate(c).model_dump()
                                   for c in rows(models.ProductCategory)],
                    "products": [{**ser.product(p), "stock": p.stock} for p in rows(models.Product)],
                    "users": [
                        {**schemas.UserOut.model_validate(u).model_dump(),
                         "password": "admin123" if u.is_admin else "demo123"}
                        for u in rows(models.User)
                    ],
                    "bookings": [
                        {**ser.booking(b), "user_id": b.user_id, "service_id": b.service_id,
                         "date_offset": (date.fromisoformat(b.date) - date.today()).days}
                        for b in rows(models.Booking)
                    ],
                    "orders": [],
                }
        finally:
            engine.dispose()

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    result = export_demo(args.output)
    print(f"Public demo exported: {len(result['barbershops'])} shops, {len(result['products'])} products")

"""Run once to populate the DB with the v1 t-shirt product.

Idempotent — re-running after a successful seed is a no-op. After the
2026-05-05 schema migration, products no longer carry colors/sizes JSON;
variants live in `product_variants` and are seeded here.
"""
from database import SessionLocal
from models import PlacementZone, Product, ProductVariant


# Placeholder Printful catalog variant IDs. Replace with real values
# from https://www.printful.com/api/products once the Printful account
# is provisioned (see Phase 0 open question #2 in the revised plan).
PRINTFUL_VARIANT_IDS = {
    ("White", "S"):   "PF_WHITE_S",
    ("White", "M"):   "PF_WHITE_M",
    ("White", "L"):   "PF_WHITE_L",
    ("White", "XL"):  "PF_WHITE_XL",
    ("White", "XXL"): "PF_WHITE_XXL",
    ("Black", "S"):   "PF_BLACK_S",
    ("Black", "M"):   "PF_BLACK_M",
    ("Black", "L"):   "PF_BLACK_L",
    ("Black", "XL"):  "PF_BLACK_XL",
    ("Black", "XXL"): "PF_BLACK_XXL",
}

SIZES = ["S", "M", "L", "XL", "XXL"]
COLORS = ["White", "Black"]


def seed():
    db = SessionLocal()
    try:
        existing = db.query(Product).filter_by(name="Classic T-Shirt").first()
        if existing:
            print("Already seeded.")
            return

        shirt = Product(
            name="Classic T-Shirt",
            type="shirt",
            base_price=20.00,
        )
        db.add(shirt)
        db.flush()

        for color in COLORS:
            for size in SIZES:
                db.add(
                    ProductVariant(
                        product_id=shirt.id,
                        color=color,
                        size=size,
                        printful_variant_id=PRINTFUL_VARIANT_IDS[(color, size)],
                        price_delta=0.00,
                    )
                )

        zones = [
            PlacementZone(
                product_id=shirt.id, name="left_chest",
                add_on_price=8.00, max_width_mm=80, max_height_mm=80,
                position_on_mockup={"x_pct": 0.30, "y_pct": 0.32, "w_pct": 0.18, "h_pct": 0.18},
            ),
            PlacementZone(
                product_id=shirt.id, name="center_chest",
                add_on_price=12.00, max_width_mm=120, max_height_mm=100,
                position_on_mockup={"x_pct": 0.38, "y_pct": 0.40, "w_pct": 0.24, "h_pct": 0.20},
            ),
            PlacementZone(
                product_id=shirt.id, name="right_chest",
                add_on_price=8.00, max_width_mm=80, max_height_mm=80,
                position_on_mockup={"x_pct": 0.52, "y_pct": 0.32, "w_pct": 0.18, "h_pct": 0.18},
            ),
            PlacementZone(
                product_id=shirt.id, name="full_back",
                add_on_price=18.00, max_width_mm=200, max_height_mm=250,
                position_on_mockup={"x_pct": 0.20, "y_pct": 0.20, "w_pct": 0.60, "h_pct": 0.55},
            ),
        ]
        db.add_all(zones)
        db.commit()
        print(f"Seeded product: {shirt.id}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()

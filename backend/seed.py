"""Idempotent catalog seed.

Creates the v1 product catalog: 6 garments across 4 garment types
(shirt, hoodie, jacket, cap, beanie). Each product has its own valid
placement zones, variants (color × size), and Printful catalog IDs.

Re-running is a no-op for any product that already exists by slug;
new products are inserted alongside existing ones.
"""
from decimal import Decimal

from database import SessionLocal
from models import PlacementZone, PrintMethod, Product, ProductVariant


# ── Per-product variant pricing ─────────────────────────────────
# These are placeholder Printful catalog variant IDs. Replace with the
# real values from https://www.printful.com/api/products before launch.
def _make_variant_ids(slug: str, colors: list[str], sizes: list[str]) -> dict:
    return {
        (color, size): f"PF_{slug.upper().replace('-', '_')}_{color.upper()}_{size.upper()}"
        for color in colors
        for size in sizes
    }


# ── Zone presets ────────────────────────────────────────────────
# (name, add_on_price, max_w_mm, max_h_mm, position {x_pct, y_pct, w_pct, h_pct})

CHEST_ZONES = [
    ("left_chest",   8.00, 80,  80,  {"x_pct": 0.30, "y_pct": 0.32, "w_pct": 0.18, "h_pct": 0.18}),
    ("center_chest", 12.00, 120, 100, {"x_pct": 0.38, "y_pct": 0.40, "w_pct": 0.24, "h_pct": 0.20}),
    ("right_chest",  8.00, 80,  80,  {"x_pct": 0.52, "y_pct": 0.32, "w_pct": 0.18, "h_pct": 0.18}),
    ("full_back",    18.00, 200, 250, {"x_pct": 0.20, "y_pct": 0.20, "w_pct": 0.60, "h_pct": 0.55}),
]

DTG_FRONT_BACK_ZONES = [
    ("front",     10.00, 250, 320, {"x_pct": 0.20, "y_pct": 0.25, "w_pct": 0.60, "h_pct": 0.55}),
    ("back",      14.00, 280, 380, {"x_pct": 0.18, "y_pct": 0.22, "w_pct": 0.64, "h_pct": 0.60}),
]

HOODIE_ZONES = [
    ("left_chest", 10.00, 80,  80,  {"x_pct": 0.30, "y_pct": 0.34, "w_pct": 0.18, "h_pct": 0.18}),
    ("full_back",  20.00, 220, 260, {"x_pct": 0.20, "y_pct": 0.20, "w_pct": 0.60, "h_pct": 0.55}),
    ("hood",       12.00, 80,  60,  {"x_pct": 0.36, "y_pct": 0.10, "w_pct": 0.28, "h_pct": 0.10}),
]

JACKET_ZONES = [
    ("left_chest", 12.00, 80, 80,  {"x_pct": 0.30, "y_pct": 0.32, "w_pct": 0.18, "h_pct": 0.18}),
    ("full_back",  24.00, 240, 280, {"x_pct": 0.18, "y_pct": 0.22, "w_pct": 0.64, "h_pct": 0.55}),
]

CAP_ZONES = [
    ("front", 10.00, 100, 50, {"x_pct": 0.30, "y_pct": 0.45, "w_pct": 0.40, "h_pct": 0.18}),
    ("back",   8.00,  60, 30, {"x_pct": 0.42, "y_pct": 0.55, "w_pct": 0.16, "h_pct": 0.08}),
]

BEANIE_ZONES = [
    ("front", 12.00, 80, 50, {"x_pct": 0.34, "y_pct": 0.48, "w_pct": 0.32, "h_pct": 0.16}),
]


# ── Product catalog ────────────────────────────────────────────

CATALOG = [
    {
        "slug": "classic-tee",
        "name": "Classic T-Shirt",
        "type": "shirt",
        "description": (
            "100% combed ring-spun cotton. Pre-shrunk, side-seamed, midweight. "
            "Soft hand-feel that holds up wash after wash."
        ),
        "print_method": PrintMethod.embroidery,
        "base_price": Decimal("20.00"),
        "colors": ["White", "Black"],
        "sizes": ["XS", "S", "M", "L", "XL", "XXL"],
        "zones": CHEST_ZONES,
    },
    {
        "slug": "essential-tee",
        "name": "Essential Soft Tee",
        "type": "shirt",
        "description": (
            "Lightweight 4.2oz cotton with a touch of Lycra in the collar. "
            "Designed for relaxed all-over print — no thread limits."
        ),
        "print_method": PrintMethod.dtg,
        "base_price": Decimal("18.00"),
        "colors": ["White", "Black", "Navy"],
        "sizes": ["XS", "S", "M", "L", "XL", "XXL"],
        "zones": DTG_FRONT_BACK_ZONES,
    },
    {
        "slug": "pullover-hoodie",
        "name": "Pullover Hoodie",
        "type": "hoodie",
        "description": (
            "Heavy 9oz cotton-poly fleece with a brushed interior. Kangaroo "
            "pocket, ribbed cuffs and hem, double-lined hood."
        ),
        "print_method": PrintMethod.embroidery,
        "base_price": Decimal("45.00"),
        "colors": ["Black", "Navy", "Forest"],
        "sizes": ["S", "M", "L", "XL", "XXL"],
        "zones": HOODIE_ZONES,
    },
    {
        "slug": "varsity-jacket",
        "name": "Varsity Jacket",
        "type": "jacket",
        "description": (
            "Wool-blend body with leather-look sleeves, snap-button placket, "
            "ribbed cuffs and hem. Made for chenille and chain-stitch crests."
        ),
        "print_method": PrintMethod.embroidery,
        "base_price": Decimal("85.00"),
        "colors": ["Black", "Navy"],
        "sizes": ["S", "M", "L", "XL", "XXL"],
        "zones": JACKET_ZONES,
    },
    {
        "slug": "dad-cap",
        "name": "Dad Cap",
        "type": "cap",
        "description": (
            "Unstructured 6-panel cotton twill cap with a curved brim and "
            "adjustable cloth strap. Embroiders cleanly on the front panel."
        ),
        "print_method": PrintMethod.embroidery,
        "base_price": Decimal("22.00"),
        "colors": ["Black", "Navy", "White"],
        "sizes": ["OS"],
        "zones": CAP_ZONES,
    },
    {
        "slug": "beanie",
        "name": "Cuffed Beanie",
        "type": "beanie",
        "description": (
            "Double-knit acrylic beanie with a folded cuff. Compact embroidery "
            "panel on the cuff itself."
        ),
        "print_method": PrintMethod.embroidery,
        "base_price": Decimal("18.00"),
        "colors": ["Black", "Charcoal", "Navy"],
        "sizes": ["OS"],
        "zones": BEANIE_ZONES,
    },
]


def _seed_product(db, spec: dict) -> Product:
    existing = db.query(Product).filter_by(slug=spec["slug"]).first()
    if existing:
        return existing

    product = Product(
        slug=spec["slug"],
        name=spec["name"],
        type=spec["type"],
        description=spec["description"],
        print_method=spec["print_method"],
        base_price=spec["base_price"],
    )
    db.add(product)
    db.flush()

    pf_ids = _make_variant_ids(spec["slug"], spec["colors"], spec["sizes"])
    for color in spec["colors"]:
        for size in spec["sizes"]:
            db.add(
                ProductVariant(
                    product_id=product.id,
                    color=color,
                    size=size,
                    printful_variant_id=pf_ids[(color, size)],
                    price_delta=Decimal("0.00"),
                )
            )

    for zname, addon, mw, mh, pos in spec["zones"]:
        db.add(
            PlacementZone(
                product_id=product.id,
                name=zname,
                add_on_price=Decimal(str(addon)),
                max_width_mm=mw,
                max_height_mm=mh,
                position_on_mockup=pos,
            )
        )

    return product


def seed():
    db = SessionLocal()
    try:
        seeded = []
        skipped = []
        for spec in CATALOG:
            existing = db.query(Product).filter_by(slug=spec["slug"]).first()
            if existing:
                skipped.append(spec["slug"])
            else:
                _seed_product(db, spec)
                seeded.append(spec["slug"])
        db.commit()
        if seeded:
            print(f"Seeded {len(seeded)} product(s): {', '.join(seeded)}")
        if skipped:
            print(f"Already present: {', '.join(skipped)}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()

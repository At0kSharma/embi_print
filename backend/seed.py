"""Run once to populate the DB with the v1 t-shirt product."""
from database import SessionLocal
from models import Product, PlacementZone

MOCKUP_BASE = "https://embi-print.s3.amazonaws.com/mockups"

def seed():
    db = SessionLocal()
    if db.query(Product).count() > 0:
        print("Already seeded.")
        db.close()
        return

    shirt = Product(
        name="Classic T-Shirt",
        type="shirt",
        base_price=20.00,
        colors=[
            {
                "name": "White",
                "hex": "#FFFFFF",
                "mockup_images": {
                    "left_chest":   f"{MOCKUP_BASE}/shirt-white-front.png",
                    "center_chest": f"{MOCKUP_BASE}/shirt-white-front.png",
                    "right_chest":  f"{MOCKUP_BASE}/shirt-white-front.png",
                    "full_back":    f"{MOCKUP_BASE}/shirt-white-back.png",
                },
            },
            {
                "name": "Black",
                "hex": "#111111",
                "mockup_images": {
                    "left_chest":   f"{MOCKUP_BASE}/shirt-black-front.png",
                    "center_chest": f"{MOCKUP_BASE}/shirt-black-front.png",
                    "right_chest":  f"{MOCKUP_BASE}/shirt-black-front.png",
                    "full_back":    f"{MOCKUP_BASE}/shirt-black-back.png",
                },
            },
        ],
        sizes=["S", "M", "L", "XL", "XXL"],
    )
    db.add(shirt)
    db.flush()

    zones = [
        PlacementZone(product_id=shirt.id, name="left_chest",   add_on_price=8.00,  max_width_mm=80,  max_height_mm=80,  position_on_mockup={"x": 95,  "y": 120, "w": 80,  "h": 80}),
        PlacementZone(product_id=shirt.id, name="center_chest", add_on_price=12.00, max_width_mm=120, max_height_mm=100, position_on_mockup={"x": 75,  "y": 155, "w": 120, "h": 100}),
        PlacementZone(product_id=shirt.id, name="right_chest",  add_on_price=8.00,  max_width_mm=80,  max_height_mm=80,  position_on_mockup={"x": 155, "y": 120, "w": 80,  "h": 80}),
        PlacementZone(product_id=shirt.id, name="full_back",    add_on_price=18.00, max_width_mm=200, max_height_mm=250, position_on_mockup={"x": 50,  "y": 80,  "w": 200, "h": 250}),
    ]
    db.add_all(zones)
    db.commit()
    product_id = shirt.id
    db.close()
    print(f"Seeded product: {product_id}")

if __name__ == "__main__":
    seed()

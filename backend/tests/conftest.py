import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app
from models import PlacementZone, Product, ProductVariant
from ratelimit import limiter

TEST_DATABASE_URL = "postgresql://embi:embi@postgres:5432/embi_test"

test_engine = create_engine(TEST_DATABASE_URL)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(autouse=True)
def override_db():
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Clear in-memory rate-limit state between tests so 10/min limit is per-test."""
    limiter.reset()
    yield


@pytest.fixture(scope="session")
def seeded_client(setup_test_db):
    """TestClient with a seeded product (variants + zones) in the test DB."""
    db = TestSessionLocal()
    try:
        shirt = Product(name="Classic T-Shirt", type="shirt", base_price=20.00)
        db.add(shirt)
        db.flush()
        for color in ("White", "Black"):
            for size in ("S", "M", "L", "XL", "XXL"):
                db.add(
                    ProductVariant(
                        product_id=shirt.id,
                        color=color,
                        size=size,
                        printful_variant_id=f"PF_{color.upper()}_{size}",
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
    finally:
        db.close()
    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)

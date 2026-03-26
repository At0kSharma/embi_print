import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db
from main import app
from models import Product, PlacementZone

# Use a separate test database
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
    """Create all tables in the test database once per session."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture(autouse=True)
def override_db():
    """Override get_db to use test database for every test."""
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()

@pytest.fixture(scope="session")
def seeded_client(setup_test_db):
    """TestClient with a seeded product in the test database."""
    db = TestSessionLocal()
    try:
        shirt = Product(
            name="Classic T-Shirt",
            type="shirt",
            base_price=20.00,
            colors=[
                {"name": "White", "hex": "#FFFFFF", "mockup_images": {"left_chest": "/mock.png", "center_chest": "/mock.png", "right_chest": "/mock.png", "full_back": "/mock.png"}},
                {"name": "Black", "hex": "#111111", "mockup_images": {"left_chest": "/mock.png", "center_chest": "/mock.png", "right_chest": "/mock.png", "full_back": "/mock.png"}},
            ],
            sizes=["S", "M", "L", "XL", "XXL"],
        )
        db.add(shirt)
        db.flush()
        zones = [
            PlacementZone(product_id=shirt.id, name="left_chest",   add_on_price=8.00,  max_width_mm=80,  max_height_mm=80,  position_on_mockup={"x": 95, "y": 120, "w": 80, "h": 80}),
            PlacementZone(product_id=shirt.id, name="center_chest", add_on_price=12.00, max_width_mm=120, max_height_mm=100, position_on_mockup={"x": 75, "y": 155, "w": 120, "h": 100}),
            PlacementZone(product_id=shirt.id, name="right_chest",  add_on_price=8.00,  max_width_mm=80,  max_height_mm=80,  position_on_mockup={"x": 155, "y": 120, "w": 80, "h": 80}),
            PlacementZone(product_id=shirt.id, name="full_back",    add_on_price=18.00, max_width_mm=200, max_height_mm=250, position_on_mockup={"x": 50, "y": 80, "w": 200, "h": 250}),
        ]
        db.add_all(zones)
        db.commit()
    finally:
        db.close()
    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)

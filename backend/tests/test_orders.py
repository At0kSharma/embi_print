"""Order creation tests.

Verifies that the server computes line totals from authoritative DB
rows — clients cannot override prices. Also verifies referential
validation.
"""
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text

from main import app
from models import Order, ProductVariant, PlacementZone, Upload, UploadStatus
from tests.conftest import TestSessionLocal


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def upload_id():
    """Insert a `done` upload directly so order creation has something to reference."""
    db = TestSessionLocal()
    try:
        u = Upload(
            s3_key="uploads/test.png",
            original_filename="logo.png",
            mime_type="image/png",
            status=UploadStatus.done,
            stitch_count=1234,
        )
        db.add(u)
        db.commit()
        return u.id
    finally:
        db.close()


@pytest.fixture
def variant_and_zone(seeded_client):
    """Pull one (variant_id, zone_id) pair from the seeded product."""
    db = TestSessionLocal()
    try:
        v = db.execute(
            select(ProductVariant).where(
                ProductVariant.color == "White", ProductVariant.size == "M"
            )
        ).scalar_one()
        z = db.execute(
            select(PlacementZone).where(PlacementZone.name == "left_chest")
        ).scalar_one()
        return v.id, z.id
    finally:
        db.close()


def _payload(variant_id: str, zone_id: str, upload_id: str, qty: int = 1):
    return {
        "customer_name": "Ada Lovelace",
        "customer_email": "ada@example.com",
        "shipping_address": {
            "line1": "1 Lovelace Way",
            "city": "London",
            "state": "London",
            "postal_code": "SW1A 1AA",
            "country": "GB",
        },
        "items": [
            {
                "variant_id": variant_id,
                "zone_id": zone_id,
                "upload_id": upload_id,
                "quantity": qty,
            }
        ],
    }


def test_create_order_happy_path(client, seeded_client, variant_and_zone, upload_id):
    variant_id, zone_id = variant_and_zone
    resp = client.post("/orders/", json=_payload(variant_id, zone_id, upload_id))
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == "pending"
    # Server computed price: base 20 + zone 8 = 28
    assert body["total_price"] == 28.0
    assert len(body["items"]) == 1
    assert body["items"][0]["unit_price"] == 28.0


def test_create_order_quantity_multiplies_total(client, seeded_client, variant_and_zone, upload_id):
    variant_id, zone_id = variant_and_zone
    resp = client.post("/orders/", json=_payload(variant_id, zone_id, upload_id, qty=3))
    assert resp.status_code == 201
    assert resp.json()["total_price"] == 84.0  # 28 * 3


def test_create_order_ignores_client_supplied_price(
    client, seeded_client, variant_and_zone, upload_id
):
    """Even if the client tries to inject unit_price, server recomputes."""
    variant_id, zone_id = variant_and_zone
    payload = _payload(variant_id, zone_id, upload_id)
    payload["items"][0]["unit_price"] = 0.01  # malicious
    payload["total_price"] = 0.01
    resp = client.post("/orders/", json=payload)
    assert resp.status_code == 201
    assert resp.json()["total_price"] == 28.0


def test_create_order_unknown_variant(client, seeded_client, variant_and_zone, upload_id):
    _, zone_id = variant_and_zone
    resp = client.post(
        "/orders/", json=_payload("not-a-real-variant", zone_id, upload_id)
    )
    assert resp.status_code == 400
    assert "variant" in resp.json()["detail"].lower()


def test_create_order_zone_variant_mismatch(client, seeded_client, upload_id):
    """variant.product_id must equal zone.product_id.

    All seeded data shares one product, so we insert a temporary second
    product to construct a mismatch, then clean it up.
    """
    from models import PlacementZone as PZ
    from models import Product
    from models import ProductVariant as PV

    db = TestSessionLocal()
    try:
        other = Product(name="__test_other__", type="shirt", base_price=10.0)
        db.add(other)
        db.flush()
        other_zone = PZ(
            product_id=other.id, name="full_back",
            add_on_price=5.0, max_width_mm=200, max_height_mm=250,
            position_on_mockup={"x_pct": 0.2, "y_pct": 0.2, "w_pct": 0.6, "h_pct": 0.55},
        )
        db.add(other_zone)
        v = db.execute(
            select(PV).where(PV.color == "White", PV.size == "M")
        ).scalar_one()
        db.commit()
        bad_zone_id = other_zone.id
        good_variant_id = v.id
        other_id = other.id
    finally:
        db.close()

    try:
        resp = client.post(
            "/orders/", json=_payload(good_variant_id, bad_zone_id, upload_id)
        )
        assert resp.status_code == 400
        assert "same product" in resp.json()["detail"].lower()
    finally:
        db = TestSessionLocal()
        try:
            db.execute(text("DELETE FROM placement_zones WHERE product_id = :pid"), {"pid": other_id})
            db.execute(text("DELETE FROM products WHERE id = :pid"), {"pid": other_id})
            db.commit()
        finally:
            db.close()


def test_get_order_not_found(client):
    assert client.get("/orders/missing").status_code == 404

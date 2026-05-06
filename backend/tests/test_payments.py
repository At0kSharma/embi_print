"""Payment intent endpoint tests.

Stripe is fully mocked — we don't hit the network. Just verifies the
endpoint stores the returned PaymentIntent id on the order and rejects
non-pending orders.
"""
from decimal import Decimal
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from main import app
from models import Order, OrderStatus, PlacementZone, ProductVariant, Upload, UploadStatus
from tests.conftest import TestSessionLocal


@pytest.fixture
def client():
    return TestClient(app)


def _seed_pending_order(seeded_client) -> str:
    db = TestSessionLocal()
    try:
        u = Upload(
            s3_key="uploads/test.png", original_filename="logo.png",
            mime_type="image/png", status=UploadStatus.done, stitch_count=1000,
        )
        db.add(u)
        db.commit()
        v = db.execute(select(ProductVariant).where(ProductVariant.color == "White", ProductVariant.size == "M")).scalar_one()
        z = db.execute(select(PlacementZone).where(PlacementZone.name == "left_chest")).scalar_one()
        upload_id, variant_id, zone_id = u.id, v.id, z.id
    finally:
        db.close()

    payload = {
        "customer_name": "Test", "customer_email": "t@e.com",
        "shipping_address": {"line1": "1", "city": "x", "state": "x", "postal_code": "1", "country": "US"},
        "items": [{"variant_id": variant_id, "zone_id": zone_id, "upload_id": upload_id, "quantity": 1}],
    }
    resp = TestClient(app).post("/orders/", json=payload)
    assert resp.status_code == 201, f"order create failed: {resp.status_code} {resp.text}"
    return resp.json()["id"]


def test_create_payment_intent(client, seeded_client):
    order_id = _seed_pending_order(seeded_client)
    with patch(
        "routers.payments.create_payment_intent",
        return_value=("pi_test_123", "pi_test_123_secret_xyz"),
    ) as mock_pi:
        resp = client.post(f"/orders/{order_id}/payment-intent")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["payment_intent_id"] == "pi_test_123"
    assert body["client_secret"] == "pi_test_123_secret_xyz"
    mock_pi.assert_called_once()
    kwargs = mock_pi.call_args.kwargs
    assert kwargs["order_id"] == order_id
    assert kwargs["amount_usd"] == Decimal("28.00")

    db = TestSessionLocal()
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        assert order.stripe_payment_intent_id == "pi_test_123"
    finally:
        db.close()


def test_payment_intent_rejects_non_pending_order(client, seeded_client):
    order_id = _seed_pending_order(seeded_client)
    db = TestSessionLocal()
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        order.status = OrderStatus.paid
        db.commit()
    finally:
        db.close()

    resp = client.post(f"/orders/{order_id}/payment-intent")
    assert resp.status_code == 409


def test_payment_intent_unknown_order(client):
    resp = client.post("/orders/missing/payment-intent")
    assert resp.status_code == 404

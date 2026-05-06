"""Webhook tests.

Stripe signature verification is mocked at `construct_event` so we don't
need real signing. Idempotency is the most important property here:
re-delivering the same `payment_intent.succeeded` event must not call
Printful twice or transition the order back to `paid`.
"""
import json
import os
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from main import app
from models import (
    Order,
    OrderStatus,
    PlacementZone,
    ProductVariant,
    Upload,
    UploadStatus,
)
from tests.conftest import TestSessionLocal


@pytest.fixture(autouse=True)
def stripe_secret_env(monkeypatch):
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test")
    yield


@pytest.fixture
def client():
    return TestClient(app)


def _seed_paid_intent_order(intent_id: str = "pi_test_42") -> str:
    """Insert an order in `pending` status with a stripe_payment_intent_id set."""
    db = TestSessionLocal()
    try:
        u = Upload(
            s3_key="uploads/test.png", original_filename="logo.png",
            mime_type="image/png", status=UploadStatus.done, stitch_count=1000,
        )
        db.add(u)
        db.flush()
        v = db.execute(select(ProductVariant).where(ProductVariant.color == "White", ProductVariant.size == "M")).scalar_one()
        z = db.execute(select(PlacementZone).where(PlacementZone.name == "left_chest")).scalar_one()
        order = Order(
            customer_name="Test", customer_email="t@e.com",
            shipping_address={"line1": "1", "city": "x", "state": "x", "postal_code": "1", "country": "US"},
            status=OrderStatus.pending,
            stripe_payment_intent_id=intent_id,
            total_price=28.0,
        )
        db.add(order)
        db.flush()
        from models import OrderItem
        db.add(OrderItem(
            order_id=order.id, product_id=v.product_id, variant_id=v.id,
            zone_id=z.id, upload_id=u.id, quantity=1, unit_price=28.0,
        ))
        db.commit()
        return order.id
    finally:
        db.close()


def _stripe_event(intent_id: str) -> dict:
    return {
        "id": "evt_test",
        "type": "payment_intent.succeeded",
        "data": {"object": {"id": intent_id}},
    }


def test_stripe_webhook_marks_paid_and_submits(client, seeded_client):
    order_id = _seed_paid_intent_order("pi_aaa")
    with (
        patch("routers.webhooks.construct_event", return_value=_stripe_event("pi_aaa")),
        patch("routers.webhooks.printful_submit", return_value="pf_999") as pf,
        patch("routers.webhooks.send_order_confirmation") as email,
        patch("routers.webhooks.get_presigned_url", return_value="https://example/x"),
    ):
        resp = client.post("/webhooks/stripe", content=b"{}", headers={"stripe-signature": "sig"})
    assert resp.status_code == 200
    assert resp.json() == {"received": True}

    pf.assert_called_once()
    email.assert_called_once()

    db = TestSessionLocal()
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        assert order.status == OrderStatus.submitted_to_printful
        assert order.printful_order_id == "pf_999"
    finally:
        db.close()


def test_stripe_webhook_idempotent_replay(client, seeded_client):
    """Same event delivered twice ⇒ Printful called once."""
    order_id = _seed_paid_intent_order("pi_bbb")
    with (
        patch("routers.webhooks.construct_event", return_value=_stripe_event("pi_bbb")),
        patch("routers.webhooks.printful_submit", return_value="pf_replay") as pf,
        patch("routers.webhooks.send_order_confirmation"),
        patch("routers.webhooks.get_presigned_url", return_value="https://example/x"),
    ):
        client.post("/webhooks/stripe", content=b"{}", headers={"stripe-signature": "sig"})
        resp2 = client.post("/webhooks/stripe", content=b"{}", headers={"stripe-signature": "sig"})

    assert resp2.status_code == 200
    assert resp2.json().get("already_processed") is True
    assert pf.call_count == 1


def test_stripe_webhook_bad_signature(client, seeded_client):
    from services.stripe_service import StripeSignatureError
    with patch("routers.webhooks.construct_event", side_effect=StripeSignatureError("bad")):
        resp = client.post("/webhooks/stripe", content=b"{}", headers={"stripe-signature": "sig"})
    assert resp.status_code == 400


def test_stripe_webhook_missing_signature(client, seeded_client):
    resp = client.post("/webhooks/stripe", content=b"{}")
    assert resp.status_code == 400


def test_stripe_webhook_unknown_intent(client, seeded_client):
    with patch("routers.webhooks.construct_event", return_value=_stripe_event("pi_unknown")):
        resp = client.post("/webhooks/stripe", content=b"{}", headers={"stripe-signature": "sig"})
    assert resp.status_code == 200
    assert "unknown_intent" in resp.json()


def test_stripe_webhook_other_event_type_ignored(client, seeded_client):
    evt = {"type": "charge.refunded", "data": {"object": {}}}
    with patch("routers.webhooks.construct_event", return_value=evt):
        resp = client.post("/webhooks/stripe", content=b"{}", headers={"stripe-signature": "sig"})
    assert resp.status_code == 200
    assert resp.json().get("ignored") == "charge.refunded"


def test_printful_failure_leaves_order_at_paid(client, seeded_client):
    """If Printful is down the order stays at `paid` so it can be retried."""
    from services.printful import PrintfulError
    order_id = _seed_paid_intent_order("pi_ccc")
    with (
        patch("routers.webhooks.construct_event", return_value=_stripe_event("pi_ccc")),
        patch("routers.webhooks.printful_submit", side_effect=PrintfulError("boom")),
        patch("routers.webhooks.send_order_confirmation") as email,
        patch("routers.webhooks.get_presigned_url", return_value="https://example/x"),
    ):
        resp = client.post("/webhooks/stripe", content=b"{}", headers={"stripe-signature": "sig"})
    assert resp.status_code == 200
    email.assert_not_called()

    db = TestSessionLocal()
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        assert order.status == OrderStatus.paid
        assert order.printful_order_id is None
    finally:
        db.close()


def test_printful_webhook_marks_shipped(client, seeded_client):
    order_id = _seed_paid_intent_order("pi_ddd")
    db = TestSessionLocal()
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        order.status = OrderStatus.submitted_to_printful
        order.printful_order_id = "pf_111"
        db.commit()
    finally:
        db.close()

    body = {
        "type": "package_shipped",
        "data": {"order": {"id": "pf_111"}, "shipment": {"tracking_number": "TRACK123"}},
    }
    resp = client.post("/webhooks/printful", json=body)
    assert resp.status_code == 200

    db = TestSessionLocal()
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        assert order.status == OrderStatus.shipped
        assert order.tracking_number == "TRACK123"
    finally:
        db.close()


def test_printful_webhook_idempotent(client, seeded_client):
    order_id = _seed_paid_intent_order("pi_eee")
    db = TestSessionLocal()
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        order.status = OrderStatus.shipped
        order.printful_order_id = "pf_222"
        order.tracking_number = "TRACK_ORIG"
        db.commit()
    finally:
        db.close()

    body = {
        "type": "package_shipped",
        "data": {"order": {"id": "pf_222"}, "shipment": {"tracking_number": "TRACK_NEW"}},
    }
    resp = client.post("/webhooks/printful", json=body)
    assert resp.status_code == 200
    assert resp.json().get("already_processed") is True

    db = TestSessionLocal()
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        assert order.tracking_number == "TRACK_ORIG"  # not overwritten
    finally:
        db.close()

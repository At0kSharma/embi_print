"""Admin API tests.

Covers:
- HTTP basic auth gate: missing creds → 401; bad creds → 401; correct → 200
- Product CRUD: create / list / get / update / delete + slug uniqueness
- Variant + zone management
- Mockup upload writes to S3 (mocked) and stores URL on the product

Auth env vars are set per-test via monkeypatch so the rest of the
test suite (which doesn't authenticate) keeps the admin routes
gated.
"""
from io import BytesIO
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture(autouse=True)
def admin_creds(monkeypatch):
    monkeypatch.setenv("ADMIN_USER", "admin")
    monkeypatch.setenv("ADMIN_PASSWORD", "secret")
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth():
    return ("admin", "secret")


# ── Auth gate ────────────────────────────────────────────────────


def test_admin_requires_auth(client):
    resp = client.get("/admin/products")
    assert resp.status_code == 401


def test_admin_rejects_bad_password(client):
    resp = client.get("/admin/products", auth=("admin", "wrong"))
    assert resp.status_code == 401


def test_admin_503_when_unconfigured(client, monkeypatch):
    monkeypatch.delenv("ADMIN_USER", raising=False)
    resp = client.get("/admin/products", auth=("admin", "secret"))
    assert resp.status_code == 503


def test_admin_lists_products_with_auth(client, auth, seeded_client):
    resp = client.get("/admin/products", auth=auth)
    assert resp.status_code == 200
    products = resp.json()
    assert any(p["slug"] == "classic-tee" for p in products)


# ── Product CRUD ─────────────────────────────────────────────────


def test_create_product(client, auth, seeded_client):
    resp = client.post(
        "/admin/products",
        auth=auth,
        json={
            "slug": "test-tee",
            "name": "Test Tee",
            "type": "shirt",
            "description": "A tee for tests",
            "print_method": "embroidery",
            "base_price": 25.50,
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["slug"] == "test-tee"
    assert body["base_price"] == 25.50
    assert body["zones"] == []
    assert body["variants"] == []


def test_create_product_rejects_duplicate_slug(client, auth, seeded_client):
    payload = {
        "slug": "classic-tee",
        "name": "Dup",
        "type": "shirt",
        "print_method": "embroidery",
        "base_price": 1.0,
    }
    resp = client.post("/admin/products", auth=auth, json=payload)
    assert resp.status_code == 409


def test_create_product_validates_slug_format(client, auth, seeded_client):
    payload = {
        "slug": "Has Spaces",
        "name": "Bad",
        "type": "shirt",
        "print_method": "embroidery",
        "base_price": 1.0,
    }
    resp = client.post("/admin/products", auth=auth, json=payload)
    assert resp.status_code == 422


def test_update_product(client, auth, seeded_client):
    create = client.post(
        "/admin/products",
        auth=auth,
        json={
            "slug": "update-target",
            "name": "Original",
            "type": "shirt",
            "print_method": "embroidery",
            "base_price": 10.0,
        },
    )
    pid = create.json()["id"]

    resp = client.put(
        f"/admin/products/{pid}",
        auth=auth,
        json={"name": "Renamed", "base_price": 20.0},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Renamed"
    assert body["base_price"] == 20.0
    assert body["slug"] == "update-target"  # unchanged


def test_delete_product(client, auth, seeded_client):
    create = client.post(
        "/admin/products",
        auth=auth,
        json={
            "slug": "delete-me",
            "name": "Delete me",
            "type": "shirt",
            "print_method": "embroidery",
            "base_price": 5.0,
        },
    )
    pid = create.json()["id"]
    resp = client.delete(f"/admin/products/{pid}", auth=auth)
    assert resp.status_code == 204
    assert client.get(f"/admin/products/{pid}", auth=auth).status_code == 404


# ── Variants ─────────────────────────────────────────────────────


def test_add_variant(client, auth, seeded_client):
    create = client.post(
        "/admin/products",
        auth=auth,
        json={
            "slug": "variant-test",
            "name": "Variant test",
            "type": "shirt",
            "print_method": "embroidery",
            "base_price": 10.0,
        },
    )
    pid = create.json()["id"]

    resp = client.post(
        f"/admin/products/{pid}/variants",
        auth=auth,
        json={
            "color": "Crimson",
            "size": "M",
            "printful_variant_id": "PF_TEST_M",
            "price_delta": 0,
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert len(body["variants"]) == 1
    assert body["variants"][0]["color"] == "Crimson"


def test_add_variant_rejects_duplicate(client, auth, seeded_client):
    create = client.post(
        "/admin/products",
        auth=auth,
        json={
            "slug": "dup-variant",
            "name": "Dup variant",
            "type": "shirt",
            "print_method": "embroidery",
            "base_price": 10.0,
        },
    )
    pid = create.json()["id"]
    payload = {
        "color": "Crimson",
        "size": "M",
        "printful_variant_id": "PF_X",
        "price_delta": 0,
    }
    client.post(f"/admin/products/{pid}/variants", auth=auth, json=payload)
    resp = client.post(f"/admin/products/{pid}/variants", auth=auth, json=payload)
    assert resp.status_code == 409


# ── Zones ────────────────────────────────────────────────────────


def test_add_zone(client, auth, seeded_client):
    create = client.post(
        "/admin/products",
        auth=auth,
        json={
            "slug": "zone-test",
            "name": "Zone test",
            "type": "shirt",
            "print_method": "embroidery",
            "base_price": 10.0,
        },
    )
    pid = create.json()["id"]

    resp = client.post(
        f"/admin/products/{pid}/zones",
        auth=auth,
        json={
            "name": "front",
            "add_on_price": 8.0,
            "max_width_mm": 100,
            "max_height_mm": 100,
            "position_on_mockup": {"x_pct": 0.3, "y_pct": 0.3, "w_pct": 0.4, "h_pct": 0.4},
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert len(body["zones"]) == 1
    assert body["zones"][0]["name"] == "front"


def test_add_zone_validates_position_bounds(client, auth, seeded_client):
    create = client.post(
        "/admin/products",
        auth=auth,
        json={
            "slug": "zone-bounds",
            "name": "Zone bounds",
            "type": "shirt",
            "print_method": "embroidery",
            "base_price": 10.0,
        },
    )
    pid = create.json()["id"]

    resp = client.post(
        f"/admin/products/{pid}/zones",
        auth=auth,
        json={
            "name": "bad",
            "add_on_price": 1,
            "max_width_mm": 10,
            "max_height_mm": 10,
            "position_on_mockup": {"x_pct": 1.5, "y_pct": 0.5, "w_pct": 0.5, "h_pct": 0.5},
        },
    )
    assert resp.status_code == 422


# ── Mockup upload ────────────────────────────────────────────────


def test_upload_mockup_writes_url(client, auth, seeded_client):
    create = client.post(
        "/admin/products",
        auth=auth,
        json={
            "slug": "mockup-test",
            "name": "Mockup test",
            "type": "shirt",
            "print_method": "embroidery",
            "base_price": 10.0,
        },
    )
    pid = create.json()["id"]

    files = {"file": ("logo.png", BytesIO(b"\x89PNG fake"), "image/png")}
    data = {"color": "white", "view": "front"}

    with patch("routers.admin.s3.put_object") as put:
        resp = client.post(
            f"/admin/products/{pid}/mockups",
            auth=auth,
            data=data,
            files=files,
        )
    assert resp.status_code == 200, resp.text
    put.assert_called_once()
    body = resp.json()
    assert body["mockups"]
    assert "white" in body["mockups"]
    assert "front" in body["mockups"]["white"]
    assert body["mockups"]["white"]["front"].startswith("http")


def test_upload_mockup_rejects_unsupported_mime(client, auth, seeded_client):
    create = client.post(
        "/admin/products",
        auth=auth,
        json={
            "slug": "mockup-mime",
            "name": "MIME test",
            "type": "shirt",
            "print_method": "embroidery",
            "base_price": 10.0,
        },
    )
    pid = create.json()["id"]

    files = {"file": ("doc.pdf", BytesIO(b"%PDF"), "application/pdf")}
    data = {"color": "white", "view": "front"}
    resp = client.post(
        f"/admin/products/{pid}/mockups",
        auth=auth,
        data=data,
        files=files,
    )
    assert resp.status_code == 400


# ── Orders (read-only) ───────────────────────────────────────────


def test_admin_orders_empty(client, auth, seeded_client):
    resp = client.get("/admin/orders", auth=auth)
    assert resp.status_code == 200
    # Cleanup fixture wipes orders between tests, so this is empty.
    assert resp.json() == []

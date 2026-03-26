import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_list_products_empty_returns_200():
    """Empty product list returns 200, not a 500."""
    response = client.get("/products/")
    assert response.status_code == 200
    assert response.json() == []

def test_get_product_not_found():
    response = client.get("/products/does-not-exist")
    assert response.status_code == 404

def test_seeded_product_has_correct_structure(seeded_client):
    products = seeded_client.get("/products/").json()
    assert len(products) == 1
    product = products[0]
    assert product["name"] == "Classic T-Shirt"
    assert product["base_price"] == 20.0
    assert len(product["zones"]) == 4
    zone_names = {z["name"] for z in product["zones"]}
    assert zone_names == {"left_chest", "center_chest", "right_chest", "full_back"}
    left = next(z for z in product["zones"] if z["name"] == "left_chest")
    assert left["add_on_price"] == 8.0
    assert "x" in left["position_on_mockup"]

def test_get_product_by_id(seeded_client):
    products = seeded_client.get("/products/").json()
    product_id = products[0]["id"]
    resp = seeded_client.get(f"/products/{product_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == product_id
    assert len(resp.json()["zones"]) == 4

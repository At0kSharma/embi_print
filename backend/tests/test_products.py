import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_list_products_returns_200():
    response = client.get("/products/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_get_product_not_found():
    response = client.get("/products/does-not-exist")
    assert response.status_code == 404

def test_get_seeded_product_has_zones():
    products = client.get("/products/").json()
    assert len(products) > 0
    product = products[0]
    assert len(product["zones"]) == 4
    zone_names = [z["name"] for z in product["zones"]]
    assert "left_chest" in zone_names
    assert "full_back" in zone_names

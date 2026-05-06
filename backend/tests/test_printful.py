"""Printful client unit tests.

We don't hit the live API. These verify retry behavior and payload
construction; the network call is patched.
"""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import httpx
import pytest

from services import printful
from services.printful import PrintfulError, submit_order


@pytest.fixture(autouse=True)
def _api_key(monkeypatch):
    monkeypatch.setenv("PRINTFUL_API_KEY", "test-key")
    yield


def _fake_order():
    addr = {"line1": "1 X", "line2": None, "city": "C", "state": "S", "postal_code": "12345", "country": "US"}
    line = SimpleNamespace(
        upload_id="u1",
        quantity=2,
        variant=SimpleNamespace(printful_variant_id="PF_42"),
        zone=SimpleNamespace(name="left_chest"),
    )
    return SimpleNamespace(
        id="ord_xyz",
        customer_name="Test",
        customer_email="t@e.com",
        shipping_address=addr,
        items=[line],
    )


def test_submit_order_uses_external_id_for_idempotency():
    order = _fake_order()
    captured = {}

    def fake_request(method, url, json=None, headers=None):
        captured["json"] = json
        captured["url"] = url
        return httpx.Response(200, json={"result": {"id": 999}})

    with patch.object(httpx.Client, "request", side_effect=lambda *a, **kw: fake_request(*a, **kw)):
        pf_id = submit_order(order, image_urls={"u1": "https://s3/x"})

    assert pf_id == "999"
    assert captured["json"]["external_id"] == "ord_xyz"
    assert captured["json"]["items"][0]["variant_id"] == "PF_42"
    assert captured["json"]["items"][0]["quantity"] == 2
    assert captured["json"]["items"][0]["files"][0]["url"] == "https://s3/x"


def test_submit_order_retries_on_5xx_then_succeeds():
    order = _fake_order()
    responses = [
        httpx.Response(503, text="upstream down"),
        httpx.Response(200, json={"result": {"id": 7}}),
    ]
    iter_responses = iter(responses)

    def side_effect(method, url, json=None, headers=None):
        return next(iter_responses)

    with patch.object(httpx.Client, "request", side_effect=lambda *a, **kw: side_effect(*a, **kw)):
        pf_id = submit_order(order, image_urls={"u1": "https://s3/x"})
    assert pf_id == "7"


def test_submit_order_4xx_raises_immediately():
    order = _fake_order()
    with patch.object(
        httpx.Client, "request",
        return_value=httpx.Response(400, text="bad data"),
    ):
        with pytest.raises(PrintfulError):
            submit_order(order, image_urls={"u1": "https://s3/x"})


def test_submit_order_gives_up_after_max_retries():
    order = _fake_order()
    with patch.object(
        httpx.Client, "request",
        return_value=httpx.Response(503, text="down"),
    ):
        with pytest.raises(PrintfulError):
            submit_order(order, image_urls={"u1": "https://s3/x"})


def test_missing_api_key_raises(monkeypatch):
    monkeypatch.delenv("PRINTFUL_API_KEY", raising=False)
    order = _fake_order()
    with pytest.raises(PrintfulError, match="not configured"):
        submit_order(order, image_urls={"u1": "https://s3/x"})

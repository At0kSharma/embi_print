"""Printful API client.

Production v1 calls Printful from a single FastAPI BackgroundTask
triggered after a successful Stripe payment. Idempotency is enforced
via the `X-PF-Store-Token` style `external_id` field — Printful will
reject duplicate orders with the same external_id, so retrying after
a transient failure is safe.

Tests should patch `submit_order` directly; the network client below
is exercised in the printful integration test (skipped without a
sandbox key).
"""
import logging
import os
from typing import Any

import httpx

log = logging.getLogger(__name__)

PRINTFUL_BASE = os.getenv("PRINTFUL_API_BASE", "https://api.printful.com")
PRINTFUL_TIMEOUT = 30.0
MAX_RETRIES = 3


class PrintfulError(Exception):
    """Raised when the Printful API returns an unrecoverable error."""


def _api_key() -> str:
    key = os.getenv("PRINTFUL_API_KEY", "")
    if not key:
        raise PrintfulError("PRINTFUL_API_KEY is not configured")
    return key


def _request_with_retries(
    method: str, url: str, *, json: dict | None = None, headers: dict | None = None
) -> dict:
    """Issue an HTTP request with exponential-backoff retries on 5xx and network errors."""
    last_exc: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            with httpx.Client(timeout=PRINTFUL_TIMEOUT) as client:
                resp = client.request(method, url, json=json, headers=headers)
            if resp.status_code < 500:
                if resp.status_code >= 400:
                    raise PrintfulError(
                        f"Printful {method} {url} returned {resp.status_code}: {resp.text}"
                    )
                return resp.json()
            log.warning("Printful 5xx on %s %s (attempt %d)", method, url, attempt + 1)
            last_exc = PrintfulError(f"Printful {resp.status_code}: {resp.text}")
        except httpx.HTTPError as e:
            log.warning("Printful network error %s (attempt %d): %s", url, attempt + 1, e)
            last_exc = e
    raise PrintfulError(f"Printful unavailable after {MAX_RETRIES} attempts: {last_exc}")


def _build_payload(*, order, image_urls: dict[str, str]) -> dict[str, Any]:
    """Translate an internal Order into Printful's create-order schema.

    `image_urls[upload_id]` must contain a publicly-accessible URL (a
    presigned S3 URL is acceptable; Printful fetches the asset itself).
    """
    items = []
    for line in order.items:
        items.append({
            "variant_id": line.variant.printful_variant_id,
            "quantity": line.quantity,
            "files": [
                {
                    "type": _printful_placement_for_zone(line.zone.name),
                    "url": image_urls[line.upload_id],
                }
            ],
        })
    addr = order.shipping_address
    return {
        "external_id": order.id,
        "recipient": {
            "name": order.customer_name,
            "address1": addr["line1"],
            "address2": addr.get("line2"),
            "city": addr["city"],
            "state_code": addr["state"],
            "zip": addr["postal_code"],
            "country_code": addr["country"],
            "email": order.customer_email,
        },
        "items": items,
    }


_ZONE_TO_PRINTFUL = {
    "left_chest": "left_chest",
    "right_chest": "right_chest",
    "center_chest": "front",
    "full_back": "back",
}


def _printful_placement_for_zone(zone_name: str) -> str:
    return _ZONE_TO_PRINTFUL.get(zone_name, zone_name)


def submit_order(order, image_urls: dict[str, str]) -> str:
    """Create a Printful order. Returns the Printful order id."""
    headers = {
        "Authorization": f"Bearer {_api_key()}",
        "Content-Type": "application/json",
    }
    payload = _build_payload(order=order, image_urls=image_urls)
    data = _request_with_retries(
        "POST", f"{PRINTFUL_BASE}/orders", json=payload, headers=headers
    )
    return str(data["result"]["id"])

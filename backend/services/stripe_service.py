"""Thin Stripe SDK wrappers used by the payments router and webhook
handler. Keeps the SDK import in one place so it's easy to mock in tests.
"""
import os
from decimal import Decimal

import stripe

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")


class StripeSignatureError(Exception):
    """Raised when a webhook signature does not validate."""


def create_payment_intent(
    *, amount_usd: Decimal, order_id: str
) -> tuple[str, str]:
    """Create a PaymentIntent. Returns (payment_intent_id, client_secret).

    `idempotency_key` ensures retrying this call with the same order_id
    won't create duplicate PaymentIntents.
    """
    amount_cents = int((amount_usd * 100).quantize(Decimal("1")))
    intent = stripe.PaymentIntent.create(
        amount=amount_cents,
        currency="usd",
        metadata={"order_id": order_id},
        idempotency_key=f"pi_{order_id}",
    )
    return intent["id"], intent["client_secret"]


def construct_event(payload: bytes, sig_header: str, secret: str) -> dict:
    """Verify webhook signature and parse the event. Raises on bad signature."""
    try:
        return stripe.Webhook.construct_event(payload, sig_header, secret)
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        raise StripeSignatureError(str(e)) from e

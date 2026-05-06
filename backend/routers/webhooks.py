"""Stripe and Printful webhook handlers.

Both handlers are idempotent: receiving the same event twice produces
the same end state with no side-effect duplication. This matters
because both providers are at-least-once.
"""
import logging
import os

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session, selectinload

import database
from database import get_db
from models import Order, OrderItem, OrderStatus
from services.email import send_order_confirmation, send_shipped_notification
from services.printful import PrintfulError
from services.printful import submit_order as printful_submit
from services.stripe_service import StripeSignatureError, construct_event
from storage import get_presigned_url

log = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    db: Session = Depends(get_db),
):
    secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    if not secret:
        raise HTTPException(500, "Stripe webhook secret not configured")
    if not stripe_signature:
        raise HTTPException(400, "Missing stripe-signature header")

    payload = await request.body()
    try:
        event = construct_event(payload, stripe_signature, secret)
    except StripeSignatureError as e:
        raise HTTPException(400, f"Bad signature: {e}") from e

    if event["type"] != "payment_intent.succeeded":
        return {"received": True, "ignored": event["type"]}

    intent_id = event["data"]["object"]["id"]
    order = (
        db.query(Order)
        .filter(Order.stripe_payment_intent_id == intent_id)
        .first()
    )
    if not order:
        log.warning("Stripe webhook for unknown payment_intent %s", intent_id)
        return {"received": True, "unknown_intent": intent_id}

    if order.status != OrderStatus.pending:
        # Already processed. Acknowledge without side effects.
        return {"received": True, "already_processed": True}

    order.status = OrderStatus.paid
    db.commit()

    background_tasks.add_task(submit_to_printful, order.id)
    return {"received": True}


@router.post("/printful")
async def printful_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Printful shipment notifications.

    Printful sends a JSON body with `type` and `data`. We care about
    `package_shipped` events. Webhook secret verification is via shared
    secret in the URL path query in Printful's docs; we keep this simple
    in v1 and only trust the printful_order_id lookup.
    """
    body = await request.json()
    event_type = body.get("type")
    if event_type != "package_shipped":
        return {"received": True, "ignored": event_type}

    data = body.get("data", {})
    pf_order_id = str(data.get("order", {}).get("id", ""))
    tracking = data.get("shipment", {}).get("tracking_number")
    if not pf_order_id:
        raise HTTPException(400, "Missing order id in printful payload")

    order = (
        db.query(Order)
        .filter(Order.printful_order_id == pf_order_id)
        .first()
    )
    if not order:
        log.warning("Printful webhook for unknown order %s", pf_order_id)
        return {"received": True, "unknown_order": pf_order_id}

    if order.status == OrderStatus.shipped:
        return {"received": True, "already_processed": True}

    order.status = OrderStatus.shipped
    if tracking:
        order.tracking_number = tracking
    db.commit()
    db.refresh(order)

    try:
        send_shipped_notification(order)
    except Exception as e:
        log.error("Shipped notification email failed for %s: %s", order.id, e)

    return {"received": True}


def submit_to_printful(order_id: str) -> None:
    """Background task: submit a paid order to Printful + send confirmation email.

    Opens its own DB session because the request-bound session has been
    closed by the time this task runs. Lazy lookup of database.SessionLocal
    so tests can swap it for the test sessionmaker.
    """
    db = database.SessionLocal()
    try:
        order = (
            db.query(Order)
            .options(
                selectinload(Order.items).selectinload(OrderItem.variant),
                selectinload(Order.items).selectinload(OrderItem.zone),
                selectinload(Order.items).selectinload(OrderItem.upload),
            )
            .filter(Order.id == order_id)
            .first()
        )
        if not order:
            log.error("submit_to_printful: order %s not found", order_id)
            return

        if order.printful_order_id:
            log.info("submit_to_printful: order %s already submitted (%s)",
                     order_id, order.printful_order_id)
            return

        if order.status != OrderStatus.paid:
            log.warning("submit_to_printful: order %s in unexpected status %s",
                        order_id, order.status)
            return

        image_urls = {
            line.upload_id: get_presigned_url(line.upload.s3_key)
            for line in order.items
        }

        try:
            pf_id = printful_submit(order, image_urls)
        except PrintfulError as e:
            log.error("Printful submission failed for order %s: %s", order_id, e)
            return  # Order stays at `paid`; manual retry in v1.

        order.printful_order_id = pf_id
        order.status = OrderStatus.submitted_to_printful
        db.commit()
        db.refresh(order)

        try:
            send_order_confirmation(order)
        except Exception as e:
            # Email failure must not roll back the Printful submission.
            log.error("Order confirmation email failed for %s: %s", order_id, e)
    finally:
        db.close()

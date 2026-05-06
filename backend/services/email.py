"""Order-confirmation and shipped emails.

In production these go through SendGrid. When SENDGRID_API_KEY is not
set (dev / tests), the message is logged to stdout instead — no
third-party call.

Both functions accept the order ORM object directly. Failures are
surfaced as exceptions; the caller decides whether to retry.
"""
import logging
import os

log = logging.getLogger(__name__)


def _send(to: str, subject: str, body: str) -> None:
    api_key = os.getenv("SENDGRID_API_KEY")
    if not api_key:
        log.info("[email-stub] to=%s subject=%r body=%r", to, subject, body)
        return

    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail

    message = Mail(
        from_email=os.getenv("EMAIL_FROM", "noreply@embi-print.com"),
        to_emails=to,
        subject=subject,
        plain_text_content=body,
    )
    SendGridAPIClient(api_key).send(message)


def send_order_confirmation(order) -> None:
    """Sent right after a successful Stripe payment + Printful submission."""
    short_id = order.id[:8]
    item_lines = "\n".join(
        f"  - {line.quantity} × ${line.unit_price} (variant {line.variant_id[:8]})"
        for line in order.items
    )
    body = (
        f"Hi {order.customer_name},\n\n"
        f"Thanks for your order! It's been sent to fulfillment and you'll get\n"
        f"a tracking link as soon as it ships.\n\n"
        f"Order: {short_id}\n"
        f"Total: ${order.total_price}\n\n"
        f"Items:\n{item_lines}\n"
    )
    _send(order.customer_email, f"Your embi_print order {short_id} is confirmed", body)


def send_shipped_notification(order) -> None:
    """Sent when the Printful webhook reports `package_shipped`."""
    short_id = order.id[:8]
    tracking = order.tracking_number or "(not provided)"
    body = (
        f"Hi {order.customer_name},\n\n"
        f"Your order {short_id} has shipped!\n\n"
        f"Tracking: {tracking}\n\n"
        f"Thanks for ordering with embi_print.\n"
    )
    _send(order.customer_email, f"Your embi_print order {short_id} has shipped", body)

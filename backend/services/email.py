"""Order-confirmation email.

In production uses SendGrid. When SENDGRID_API_KEY is not set (dev /
tests), the message is logged to stdout instead — no third-party call.
"""
import logging
import os

log = logging.getLogger(__name__)


def send_order_confirmation(order) -> None:
    api_key = os.getenv("SENDGRID_API_KEY")
    subject = f"Your embi_print order {order.id[:8]} is confirmed"
    body = (
        f"Hi {order.customer_name},\n\n"
        f"Thanks for your order! Total: ${order.total_price}.\n"
        f"We'll email tracking once it ships.\n"
    )

    if not api_key:
        log.info("[email-stub] to=%s subject=%r body=%r", order.customer_email, subject, body)
        return

    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail

    message = Mail(
        from_email=os.getenv("EMAIL_FROM", "noreply@embi-print.com"),
        to_emails=order.customer_email,
        subject=subject,
        plain_text_content=body,
    )
    SendGridAPIClient(api_key).send(message)

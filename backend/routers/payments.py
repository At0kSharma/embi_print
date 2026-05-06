"""Payment intent creation endpoint."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Order, OrderStatus
from schemas import PaymentIntentOut
from services.stripe_service import create_payment_intent

router = APIRouter(prefix="/orders", tags=["payments"])


@router.post("/{order_id}/payment-intent", response_model=PaymentIntentOut)
def create_intent(order_id: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status != OrderStatus.pending:
        raise HTTPException(409, f"Cannot create payment intent for order in status '{order.status.value}'")

    pi_id, client_secret = create_payment_intent(
        amount_usd=order.total_price, order_id=order.id
    )
    order.stripe_payment_intent_id = pi_id
    db.commit()
    return PaymentIntentOut(client_secret=client_secret, payment_intent_id=pi_id)

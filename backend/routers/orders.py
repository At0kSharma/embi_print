"""Orders API.

Server computes line-item unit prices and the order total from
authoritative DB rows. The client never tells us the price; that
prevents trivial spoofing of paid amounts.
"""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from database import get_db
from models import (
    Order,
    OrderItem,
    OrderStatus,
    PlacementZone,
    Product,
    ProductVariant,
    Upload,
    UploadStatus,
)
from schemas import OrderCreate, OrderOut

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("/", response_model=OrderOut, status_code=201)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    order = Order(
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        shipping_address=payload.shipping_address.model_dump(),
        status=OrderStatus.pending,
        total_price=Decimal("0"),
    )
    db.add(order)
    db.flush()

    total = Decimal("0")
    for item in payload.items:
        variant = (
            db.query(ProductVariant)
            .filter(ProductVariant.id == item.variant_id)
            .first()
        )
        if not variant:
            raise HTTPException(400, f"Unknown variant: {item.variant_id}")
        zone = (
            db.query(PlacementZone)
            .filter(PlacementZone.id == item.zone_id)
            .first()
        )
        if not zone:
            raise HTTPException(400, f"Unknown zone: {item.zone_id}")
        if zone.product_id != variant.product_id:
            raise HTTPException(
                400, "Zone and variant do not belong to the same product"
            )
        upload = db.query(Upload).filter(Upload.id == item.upload_id).first()
        if not upload:
            raise HTTPException(400, f"Unknown upload: {item.upload_id}")
        if upload.status == UploadStatus.pending:
            raise HTTPException(400, "Upload is still processing")

        product = db.query(Product).filter(Product.id == variant.product_id).first()
        if not product:
            raise HTTPException(500, "Variant references missing product")

        unit_price = (
            Decimal(product.base_price)
            + Decimal(variant.price_delta)
            + Decimal(zone.add_on_price)
        )
        line_total = unit_price * item.quantity
        total += line_total

        db.add(
            OrderItem(
                order_id=order.id,
                product_id=product.id,
                variant_id=variant.id,
                zone_id=zone.id,
                upload_id=upload.id,
                quantity=item.quantity,
                unit_price=unit_price,
            )
        )

    order.total_price = total
    db.commit()

    return _load_order(db, order.id)


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: str, db: Session = Depends(get_db)):
    order = _load_order(db, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    return order


def _load_order(db: Session, order_id: str) -> Order | None:
    return (
        db.query(Order)
        .options(selectinload(Order.items))
        .filter(Order.id == order_id)
        .first()
    )

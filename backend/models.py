import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from database import Base


def new_uuid():
    return str(uuid.uuid4())


def now_utc():
    return datetime.now(timezone.utc)


class Product(Base):
    __tablename__ = "products"
    id = Column(String, primary_key=True, default=new_uuid)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    base_price = Column(Numeric(10, 2), nullable=False)
    zones = relationship("PlacementZone", back_populates="product")
    variants = relationship("ProductVariant", back_populates="product")


class ProductVariant(Base):
    __tablename__ = "product_variants"
    id = Column(String, primary_key=True, default=new_uuid)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    color = Column(String, nullable=False)
    size = Column(String, nullable=False)
    printful_variant_id = Column(String, nullable=False)
    price_delta = Column(Numeric(10, 2), nullable=False, default=0)
    product = relationship("Product", back_populates="variants")
    __table_args__ = (
        UniqueConstraint("product_id", "color", "size", name="uq_variant_product_color_size"),
    )


class PlacementZone(Base):
    __tablename__ = "placement_zones"
    id = Column(String, primary_key=True, default=new_uuid)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    name = Column(String, nullable=False)
    add_on_price = Column(Numeric(10, 2), nullable=False)
    max_width_mm = Column(Integer, nullable=False)
    max_height_mm = Column(Integer, nullable=False)
    position_on_mockup = Column(JSON, nullable=False)
    product = relationship("Product", back_populates="zones")


class UploadStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    done = "done"
    failed = "failed"


class Upload(Base):
    __tablename__ = "uploads"
    id = Column(String, primary_key=True, default=new_uuid)
    s3_key = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    status = Column(Enum(UploadStatus), default=UploadStatus.pending, nullable=False)
    dst_s3_key = Column(String, nullable=True)
    stitch_count = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    __table_args__ = (Index("ix_uploads_created_at", "created_at"),)


class OrderStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    submitted_to_printful = "submitted_to_printful"
    shipped = "shipped"
    delivered = "delivered"


class Order(Base):
    __tablename__ = "orders"
    id = Column(String, primary_key=True, default=new_uuid)
    status = Column(Enum(OrderStatus), default=OrderStatus.pending, nullable=False)
    customer_email = Column(String, nullable=False)
    customer_name = Column(String, nullable=False)
    shipping_address = Column(JSON, nullable=False)
    stripe_payment_intent_id = Column(String, nullable=True, unique=True)
    printful_order_id = Column(String, nullable=True, unique=True)
    tracking_number = Column(String, nullable=True)
    total_price = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    items = relationship("OrderItem", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(String, primary_key=True, default=new_uuid)
    order_id = Column(String, ForeignKey("orders.id"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    variant_id = Column(String, ForeignKey("product_variants.id"), nullable=False)
    zone_id = Column(String, ForeignKey("placement_zones.id"), nullable=False)
    upload_id = Column(String, ForeignKey("uploads.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Numeric(10, 2), nullable=False)
    order = relationship("Order", back_populates="items")
    variant = relationship("ProductVariant")
    zone = relationship("PlacementZone")
    upload = relationship("Upload")

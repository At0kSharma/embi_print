"""Admin endpoints: product / variant / zone CRUD + mockup uploads.

All routes here are gated by HTTP Basic Auth via require_admin. The
endpoints follow REST conventions; mockup uploads accept multipart
and write to S3/MinIO using the same client storage.py uses for
customer logo uploads.
"""
import os
import uuid
from decimal import Decimal

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from sqlalchemy.orm import Session, selectinload

from auth import require_admin
from database import get_db
from models import (
    Order,
    OrderStatus,
    PlacementZone,
    Product,
    ProductVariant,
)
from schemas import (
    AdminOrderOut,
    ProductCreate,
    ProductOut,
    ProductUpdate,
    VariantCreate,
    ZoneCreate,
    ZoneUpdate,
)
from storage import s3, BUCKET

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
)


ALLOWED_MOCKUP_MIMES = {"image/png", "image/jpeg", "image/webp"}
MAX_MOCKUP_BYTES = 5 * 1024 * 1024  # 5 MB


# ── Products ─────────────────────────────────────────────────────


@router.get("/products", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db)):
    return (
        db.query(Product)
        .options(selectinload(Product.zones), selectinload(Product.variants))
        .order_by(Product.name)
        .all()
    )


@router.post("/products", response_model=ProductOut, status_code=201)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    if db.query(Product).filter_by(slug=payload.slug).first():
        raise HTTPException(409, f"slug already exists: {payload.slug}")
    product = Product(
        slug=payload.slug,
        name=payload.name,
        type=payload.type,
        description=payload.description,
        print_method=payload.print_method,
        base_price=Decimal(str(payload.base_price)),
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return _load_product(db, product.id)


@router.get("/products/{product_id}", response_model=ProductOut)
def get_product(product_id: str, db: Session = Depends(get_db)):
    product = _load_product(db, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    return product


@router.put("/products/{product_id}", response_model=ProductOut)
def update_product(
    product_id: str, payload: ProductUpdate, db: Session = Depends(get_db)
):
    product = db.query(Product).filter_by(id=product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    if payload.name is not None:
        product.name = payload.name
    if payload.type is not None:
        product.type = payload.type
    if payload.description is not None:
        product.description = payload.description
    if payload.print_method is not None:
        product.print_method = payload.print_method
    if payload.base_price is not None:
        product.base_price = Decimal(str(payload.base_price))
    db.commit()
    return _load_product(db, product.id)


@router.delete("/products/{product_id}", status_code=204)
def delete_product(product_id: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter_by(id=product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    # Cascade-delete variants and zones; OrderItems already in flight retain
    # their FK because we don't expose product deletion via the public API
    # for products that have shipped orders. v1: trust the operator.
    db.query(ProductVariant).filter_by(product_id=product_id).delete()
    db.query(PlacementZone).filter_by(product_id=product_id).delete()
    db.delete(product)
    db.commit()


# ── Variants ─────────────────────────────────────────────────────


@router.post(
    "/products/{product_id}/variants",
    response_model=ProductOut,
    status_code=201,
)
def add_variant(
    product_id: str, payload: VariantCreate, db: Session = Depends(get_db)
):
    product = db.query(Product).filter_by(id=product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    existing = (
        db.query(ProductVariant)
        .filter_by(
            product_id=product_id, color=payload.color, size=payload.size
        )
        .first()
    )
    if existing:
        raise HTTPException(409, f"Variant already exists: {payload.color}/{payload.size}")
    variant = ProductVariant(
        product_id=product_id,
        color=payload.color,
        hex_color=payload.hex_color,
        size=payload.size,
        printful_variant_id=payload.printful_variant_id,
        price_delta=Decimal(str(payload.price_delta)),
    )
    db.add(variant)
    db.commit()
    return _load_product(db, product_id)


@router.delete("/variants/{variant_id}", status_code=204)
def delete_variant(variant_id: str, db: Session = Depends(get_db)):
    variant = db.query(ProductVariant).filter_by(id=variant_id).first()
    if not variant:
        raise HTTPException(404, "Variant not found")
    db.delete(variant)
    db.commit()


# ── Zones ────────────────────────────────────────────────────────


@router.post(
    "/products/{product_id}/zones",
    response_model=ProductOut,
    status_code=201,
)
def add_zone(
    product_id: str, payload: ZoneCreate, db: Session = Depends(get_db)
):
    product = db.query(Product).filter_by(id=product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    zone = PlacementZone(
        product_id=product_id,
        name=payload.name,
        add_on_price=Decimal(str(payload.add_on_price)),
        max_width_mm=payload.max_width_mm,
        max_height_mm=payload.max_height_mm,
        position_on_mockup=payload.position_on_mockup.model_dump(),
    )
    db.add(zone)
    db.commit()
    return _load_product(db, product_id)


@router.patch("/zones/{zone_id}", response_model=ProductOut)
def update_zone(
    zone_id: str, payload: ZoneUpdate, db: Session = Depends(get_db)
):
    zone = db.query(PlacementZone).filter_by(id=zone_id).first()
    if not zone:
        raise HTTPException(404, "Zone not found")
    if payload.name is not None:
        zone.name = payload.name
    if payload.add_on_price is not None:
        zone.add_on_price = Decimal(str(payload.add_on_price))
    if payload.max_width_mm is not None:
        zone.max_width_mm = payload.max_width_mm
    if payload.max_height_mm is not None:
        zone.max_height_mm = payload.max_height_mm
    if payload.position_on_mockup is not None:
        zone.position_on_mockup = payload.position_on_mockup.model_dump()
    db.commit()
    return _load_product(db, zone.product_id)


@router.delete("/zones/{zone_id}", status_code=204)
def delete_zone(zone_id: str, db: Session = Depends(get_db)):
    zone = db.query(PlacementZone).filter_by(id=zone_id).first()
    if not zone:
        raise HTTPException(404, "Zone not found")
    db.delete(zone)
    db.commit()


# ── Mockup uploads ───────────────────────────────────────────────


@router.post(
    "/products/{product_id}/mockups",
    response_model=ProductOut,
)
async def upload_mockup(
    product_id: str,
    color: str = Form(..., min_length=1),
    view: str = Form(..., min_length=1),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter_by(id=product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    if file.content_type not in ALLOWED_MOCKUP_MIMES:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")
    data = await file.read()
    if len(data) > MAX_MOCKUP_BYTES:
        raise HTTPException(400, f"File exceeds {MAX_MOCKUP_BYTES // 1024 // 1024} MB")

    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "png"
    key = f"mockups/{product.slug}/{color.lower()}/{view.lower()}-{uuid.uuid4().hex[:8]}.{ext}"
    s3.put_object(Bucket=BUCKET, Key=key, Body=data, ContentType=file.content_type)

    public_url = _public_object_url(key)

    mockups = dict(product.mockups or {})
    color_map = dict(mockups.get(color.lower(), {}))
    color_map[view.lower()] = public_url
    mockups[color.lower()] = color_map
    product.mockups = mockups

    db.commit()
    return _load_product(db, product_id)


def _public_object_url(key: str) -> str:
    """Build a publicly fetchable URL for a mockup object.

    For dev MinIO we use the host-mapped endpoint. In production with
    real S3 this becomes the standard https://{bucket}.s3.{region}.
    amazonaws.com/{key} pattern.
    """
    public_base = os.getenv("AWS_S3_PUBLIC_URL")
    if public_base:
        return f"{public_base.rstrip('/')}/{BUCKET}/{key}"
    endpoint = os.getenv("AWS_S3_ENDPOINT_URL")
    if endpoint:
        # MinIO with anonymous-download policy on the bucket
        return f"{endpoint.rstrip('/')}/{BUCKET}/{key}"
    region = os.getenv("AWS_REGION", "us-east-1")
    return f"https://{BUCKET}.s3.{region}.amazonaws.com/{key}"


# ── Orders (read-only) ───────────────────────────────────────────


@router.get("/orders", response_model=list[AdminOrderOut])
def list_orders(
    status: str | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    q = db.query(Order).options(selectinload(Order.items))
    if status:
        try:
            q = q.filter(Order.status == OrderStatus(status))
        except ValueError as e:
            raise HTTPException(400, f"Bad status: {status}") from e
    rows = q.order_by(Order.created_at.desc()).limit(min(limit, 500)).all()
    return [
        AdminOrderOut(
            id=o.id,
            status=o.status.value if hasattr(o.status, "value") else str(o.status),
            customer_email=o.customer_email,
            customer_name=o.customer_name,
            total_price=float(o.total_price),
            created_at=o.created_at.isoformat() if o.created_at else "",
            item_count=len(o.items),
        )
        for o in rows
    ]


# ── Helpers ──────────────────────────────────────────────────────


def _load_product(db: Session, product_id: str) -> Product | None:
    return (
        db.query(Product)
        .options(selectinload(Product.zones), selectinload(Product.variants))
        .filter(Product.id == product_id)
        .first()
    )

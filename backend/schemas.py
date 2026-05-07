from typing import Annotated, Any

from pydantic import BaseModel, EmailStr, Field


class PlacementZoneOut(BaseModel):
    id: str
    name: str
    add_on_price: float
    max_width_mm: int
    max_height_mm: int
    position_on_mockup: dict[str, float]

    model_config = {"from_attributes": True}


class ProductVariantOut(BaseModel):
    id: str
    color: str
    size: str
    price_delta: float

    model_config = {"from_attributes": True}


class ProductOut(BaseModel):
    id: str
    slug: str
    name: str
    type: str
    description: str | None = None
    print_method: str
    base_price: float
    mockups: dict[str, dict[str, str]] | None = None
    zones: list[PlacementZoneOut]
    variants: list[ProductVariantOut]

    model_config = {"from_attributes": True}


class UploadOut(BaseModel):
    id: str
    status: str
    stitch_count: int | None
    original_filename: str

    model_config = {"from_attributes": True}


class ShippingAddressIn(BaseModel):
    line1: str = Field(..., min_length=1, max_length=200)
    line2: str | None = Field(None, max_length=200)
    city: str = Field(..., min_length=1, max_length=100)
    state: str = Field(..., min_length=1, max_length=100)
    postal_code: str = Field(..., min_length=1, max_length=20)
    country: str = Field(..., min_length=2, max_length=2, description="ISO 3166-1 alpha-2")


class OrderItemIn(BaseModel):
    variant_id: str
    zone_id: str
    upload_id: str
    quantity: Annotated[int, Field(ge=1, le=100)] = 1


class OrderCreate(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=200)
    customer_email: EmailStr
    shipping_address: ShippingAddressIn
    items: list[OrderItemIn] = Field(..., min_length=1, max_length=20)


class OrderItemOut(BaseModel):
    id: str
    variant_id: str
    zone_id: str
    upload_id: str
    quantity: int
    unit_price: float

    model_config = {"from_attributes": True}


class OrderOut(BaseModel):
    id: str
    status: str
    customer_email: str
    customer_name: str
    shipping_address: dict[str, Any]
    total_price: float
    tracking_number: str | None
    items: list[OrderItemOut]

    model_config = {"from_attributes": True}


class PaymentIntentOut(BaseModel):
    client_secret: str
    payment_intent_id: str


# ── Admin schemas ────────────────────────────────────────────────


class ProductCreate(BaseModel):
    slug: str = Field(..., min_length=1, max_length=80, pattern=r"^[a-z0-9][a-z0-9-]*$")
    name: str = Field(..., min_length=1, max_length=200)
    type: str = Field(..., min_length=1, max_length=40)
    description: str | None = Field(None, max_length=2000)
    print_method: str = Field(..., pattern=r"^(embroidery|dtg)$")
    base_price: float = Field(..., ge=0)


class ProductUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    type: str | None = Field(None, min_length=1, max_length=40)
    description: str | None = Field(None, max_length=2000)
    print_method: str | None = Field(None, pattern=r"^(embroidery|dtg)$")
    base_price: float | None = Field(None, ge=0)


class VariantCreate(BaseModel):
    color: str = Field(..., min_length=1, max_length=40)
    size: str = Field(..., min_length=1, max_length=20)
    printful_variant_id: str = Field(..., min_length=1, max_length=80)
    price_delta: float = Field(0, ge=0)


class ZonePosition(BaseModel):
    x_pct: float = Field(..., ge=0, le=1)
    y_pct: float = Field(..., ge=0, le=1)
    w_pct: float = Field(..., gt=0, le=1)
    h_pct: float = Field(..., gt=0, le=1)


class ZoneCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=40)
    add_on_price: float = Field(..., ge=0)
    max_width_mm: int = Field(..., gt=0, le=1000)
    max_height_mm: int = Field(..., gt=0, le=1000)
    position_on_mockup: ZonePosition


class AdminOrderOut(BaseModel):
    id: str
    status: str
    customer_email: str
    customer_name: str
    total_price: float
    created_at: str
    item_count: int

    model_config = {"from_attributes": True}

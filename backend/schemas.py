from pydantic import BaseModel
from typing import Any


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
    name: str
    type: str
    base_price: float
    zones: list[PlacementZoneOut]
    variants: list[ProductVariantOut]

    model_config = {"from_attributes": True}


class UploadOut(BaseModel):
    id: str
    status: str
    stitch_count: int | None
    original_filename: str

    model_config = {"from_attributes": True}

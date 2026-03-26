from pydantic import BaseModel
from typing import Any

class PlacementZoneOut(BaseModel):
    id: str
    name: str
    add_on_price: float
    max_width_mm: int
    max_height_mm: int
    position_on_mockup: dict[str, Any]

    model_config = {"from_attributes": True}

class ProductOut(BaseModel):
    id: str
    name: str
    type: str
    base_price: float
    colors: list[Any]
    sizes: list[str]
    zones: list[PlacementZoneOut]

    model_config = {"from_attributes": True}

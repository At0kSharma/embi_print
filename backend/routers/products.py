from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
from database import get_db
from models import Product
from schemas import ProductOut

router = APIRouter(prefix="/products", tags=["products"])

@router.get("/", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db)):
    return db.query(Product).options(selectinload(Product.zones)).all()

@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: str, db: Session = Depends(get_db)):
    product = (
        db.query(Product)
        .options(selectinload(Product.zones))
        .filter(Product.id == product_id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

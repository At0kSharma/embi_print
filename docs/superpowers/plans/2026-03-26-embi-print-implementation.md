# embi_print Implementation Plan

> **⚠️ SUPERSEDED (2026-05-05) by [`2026-05-05-embi-print-revised.md`](./2026-05-05-embi-print-revised.md).** Tasks 1–3 were completed against this plan; the rest was replaced after a brainstorming review identified structural issues (Celery overbuilt for v1, missing Printful variant mapping, pixel-coord mockups, webhook idempotency gaps). Keep this file as historical record only — do not execute remaining tasks from here.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a custom embroidery print-on-demand web service where customers upload a logo, configure placement on a t-shirt, preview it live, and check out — fulfilled automatically via Printful.

**Architecture:** Next.js frontend with a canvas-based live mockup calls a FastAPI backend that handles uploads (S3), async DST conversion (Celery + Redis), order management (PostgreSQL), Stripe payments, and Printful fulfillment — all wired together in Docker Compose.

**Tech Stack:** Next.js 14, FastAPI, SQLAlchemy + Alembic, Celery + Redis, PostgreSQL, boto3 (S3), Stripe Python SDK, python-dotenv, pytest, React Testing Library, TypeScript

---

## File Structure

```
embi_print/
├── backend/
│   ├── main.py                  # FastAPI app, router registration
│   ├── database.py              # SQLAlchemy engine + session
│   ├── models.py                # ORM models: Product, PlacementZone, Upload, Order, OrderItem
│   ├── schemas.py               # Pydantic request/response schemas
│   ├── storage.py               # S3 upload/download helpers
│   ├── worker.py                # Celery app + DST conversion task
│   ├── routers/
│   │   ├── products.py          # GET /products, GET /products/{id}
│   │   ├── uploads.py           # POST /uploads, GET /uploads/{id}
│   │   ├── orders.py            # POST /orders, GET /orders/{id}
│   │   └── webhooks.py          # POST /webhooks/stripe, POST /webhooks/printful
│   ├── services/
│   │   ├── printful.py          # Printful API client
│   │   ├── stripe_service.py    # Stripe PaymentIntent helpers
│   │   └── email.py             # Confirmation email via SendGrid
│   ├── convert.py               # Existing DST pipeline (moved from root)
│   ├── Dockerfile               # Updated from root
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Homepage: product listing
│   │   ├── products/[id]/
│   │   │   └── page.tsx         # Product customizer page
│   │   ├── checkout/
│   │   │   └── page.tsx         # Checkout form + Stripe Elements
│   │   └── order-confirmation/
│   │       └── page.tsx         # Post-payment success screen
│   ├── components/
│   │   ├── ProductCard.tsx      # Garment card for listing
│   │   ├── ZonePicker.tsx       # Zone selector buttons with prices
│   │   ├── LogoUploader.tsx     # Drag & drop upload + status
│   │   ├── MockupCanvas.tsx     # Canvas: shirt image + logo overlay
│   │   ├── PriceBreakdown.tsx   # Base + zone add-on = total
│   │   └── CheckoutForm.tsx     # Name, email, address, Stripe Elements
│   ├── lib/
│   │   ├── api.ts               # Typed fetch wrappers for backend
│   │   └── types.ts             # Shared TypeScript interfaces
│   ├── package.json
│   └── next.config.js
├── docker-compose.yml
└── docs/
    └── superpowers/
        └── specs/2026-03-26-embi-print-design.md
```

---

## Task 1: Project Scaffolding + Docker Compose

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/main.py`
- Create: `docker-compose.yml`
- Modify: `Dockerfile` → move to `backend/Dockerfile`

- [ ] **Step 1: Move existing files into backend/**

```bash
mkdir -p backend
cp Dockerfile backend/Dockerfile
cp convert.py backend/convert.py
cp requirements.txt backend/requirements.txt 2>/dev/null || true
```

- [ ] **Step 2: Write `backend/requirements.txt`**

```text
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
alembic==1.13.1
psycopg2-binary==2.9.9
pydantic==2.7.1
pydantic-settings==2.2.1
celery==5.4.0
redis==5.0.4
boto3==1.34.101
stripe==9.9.0
sendgrid==6.11.0
python-multipart==0.0.9
httpx==0.27.0
pytest==8.2.0
pytest-asyncio==0.23.6
httpx==0.27.0
svgpathtools==1.6.1
pyembroidery==1.4.36
pillow==10.3.0
python-dotenv==1.0.1
```

- [ ] **Step 3: Write `backend/.env.example`**

```bash
DATABASE_URL=postgresql://embi:embi@postgres:5432/embi
REDIS_URL=redis://redis:6379/0
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET=embi-print
AWS_REGION=us-east-1
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PRINTFUL_API_KEY=your_printful_key
SENDGRID_API_KEY=SG....
FRONTEND_URL=http://localhost:3000
```

- [ ] **Step 4: Write `backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title="embi_print API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 5: Write `docker-compose.yml`**

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: embi
      POSTGRES_PASSWORD: embi
      POSTGRES_DB: embi
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  fastapi:
    build: ./backend
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
    volumes:
      - ./backend:/app
    ports:
      - "8000:8000"
    env_file: ./backend/.env
    depends_on:
      - postgres
      - redis

  celery:
    build: ./backend
    command: celery -A worker.celery_app worker --loglevel=info
    volumes:
      - ./backend:/app
    env_file: ./backend/.env
    depends_on:
      - postgres
      - redis

  nextjs:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    depends_on:
      - fastapi

volumes:
  pgdata:
```

- [ ] **Step 6: Update `backend/Dockerfile`**

```dockerfile
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-setuptools \
    python3-wheel \
    imagemagick \
    potrace \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt
COPY . .
```

- [ ] **Step 7: Start services and verify health**

```bash
cp backend/.env.example backend/.env
# Fill in real values in backend/.env, then:
docker compose up postgres redis fastapi -d
curl http://localhost:8000/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 8: Commit**

```bash
git add backend/ docker-compose.yml
git commit -m "feat: project scaffold — FastAPI + Docker Compose"
```

---

## Task 2: Database Models + Migrations

**Files:**
- Create: `backend/database.py`
- Create: `backend/models.py`
- Create: `backend/alembic.ini` (via alembic init)
- Create: `backend/alembic/env.py` (modified after init)

- [ ] **Step 1: Write `backend/database.py`**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://embi:embi@localhost:5432/embi")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 2: Write `backend/models.py`**

```python
from sqlalchemy import Column, String, Integer, Numeric, JSON, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime
from database import Base

def new_uuid():
    return str(uuid.uuid4())

def now_utc():
    return datetime.now(timezone.utc)

class Product(Base):
    __tablename__ = "products"
    id = Column(String, primary_key=True, default=new_uuid)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # shirt | jacket | hoodie | hat
    base_price = Column(Numeric(10, 2), nullable=False)
    colors = Column(JSON, nullable=False)  # [{name, hex, mockup_images: {left_chest, ...}}]
    sizes = Column(JSON, nullable=False)   # [S, M, L, XL, XXL]
    zones = relationship("PlacementZone", back_populates="product")

class PlacementZone(Base):
    __tablename__ = "placement_zones"
    id = Column(String, primary_key=True, default=new_uuid)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    name = Column(String, nullable=False)  # left_chest | center_chest | right_chest | full_back
    add_on_price = Column(Numeric(10, 2), nullable=False)
    max_width_mm = Column(Integer, nullable=False)
    max_height_mm = Column(Integer, nullable=False)
    position_on_mockup = Column(JSON, nullable=False)  # {x, y, w, h} in pixels
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
    stripe_payment_intent_id = Column(String, nullable=True)
    printful_order_id = Column(String, nullable=True)
    tracking_number = Column(String, nullable=True)
    total_price = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    items = relationship("OrderItem", back_populates="order")

class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(String, primary_key=True, default=new_uuid)
    order_id = Column(String, ForeignKey("orders.id"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    zone_id = Column(String, ForeignKey("placement_zones.id"), nullable=False)
    upload_id = Column(String, ForeignKey("uploads.id"), nullable=False)
    size = Column(String, nullable=False)
    color = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Numeric(10, 2), nullable=False)
    order = relationship("Order", back_populates="items")
```

- [ ] **Step 3: Initialize Alembic inside the backend container**

```bash
docker compose run --rm fastapi bash -c "alembic init alembic"
```

- [ ] **Step 4: Edit `backend/alembic/env.py` — replace the `target_metadata` line**

Find this line:
```python
target_metadata = None
```

Replace with:
```python
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from database import Base
from models import *  # noqa: F401,F403
target_metadata = Base.metadata
```

Also replace the `run_migrations_online` function's `connectable` assignment with:
```python
connectable = engine_from_config(
    {"sqlalchemy.url": os.getenv("DATABASE_URL", "postgresql://embi:embi@postgres:5432/embi")},
    prefix="sqlalchemy.",
    poolclass=pool.NullPool,
)
```

- [ ] **Step 5: Generate and apply the initial migration**

```bash
docker compose run --rm fastapi bash -c \
  "alembic revision --autogenerate -m 'initial schema' && alembic upgrade head"
```

Expected output ends with: `Running upgrade  -> <hash>, initial schema`

- [ ] **Step 6: Write test to verify tables exist**

Create `backend/tests/test_models.py`:
```python
import pytest
from sqlalchemy import create_engine, inspect
import os

def test_all_tables_exist():
    engine = create_engine(os.getenv("DATABASE_URL", "postgresql://embi:embi@localhost:5432/embi"))
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    for expected in ["products", "placement_zones", "uploads", "orders", "order_items"]:
        assert expected in tables, f"Missing table: {expected}"
```

- [ ] **Step 7: Run the test**

```bash
docker compose run --rm fastapi bash -c "cd /app && pytest tests/test_models.py -v"
```

Expected: `PASSED tests/test_models.py::test_all_tables_exist`

- [ ] **Step 8: Commit**

```bash
git add backend/database.py backend/models.py backend/alembic/ backend/alembic.ini backend/tests/
git commit -m "feat: database models and initial migration"
```

---

## Task 3: Seed Data + Products API

**Files:**
- Create: `backend/schemas.py`
- Create: `backend/routers/products.py`
- Create: `backend/seed.py`
- Modify: `backend/main.py`
- Create: `backend/tests/test_products.py`

- [ ] **Step 1: Write `backend/schemas.py`** (product-related schemas only for now)

```python
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
```

- [ ] **Step 2: Write `backend/routers/products.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Product
from schemas import ProductOut

router = APIRouter(prefix="/products", tags=["products"])

@router.get("/", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db)):
    return db.query(Product).all()

@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product
```

- [ ] **Step 3: Register router in `backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from routers import products
import os

load_dotenv()

app = FastAPI(title="embi_print API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)

@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Write `backend/seed.py`**

```python
"""Run once to populate the DB with the v1 t-shirt product."""
from database import SessionLocal
from models import Product, PlacementZone

MOCKUP_BASE = "https://embi-print.s3.amazonaws.com/mockups"

def seed():
    db = SessionLocal()
    if db.query(Product).count() > 0:
        print("Already seeded.")
        return

    shirt = Product(
        name="Classic T-Shirt",
        type="shirt",
        base_price=20.00,
        colors=[
            {
                "name": "White",
                "hex": "#FFFFFF",
                "mockup_images": {
                    "left_chest":    f"{MOCKUP_BASE}/shirt-white-front.png",
                    "center_chest":  f"{MOCKUP_BASE}/shirt-white-front.png",
                    "right_chest":   f"{MOCKUP_BASE}/shirt-white-front.png",
                    "full_back":     f"{MOCKUP_BASE}/shirt-white-back.png",
                },
            },
            {
                "name": "Black",
                "hex": "#111111",
                "mockup_images": {
                    "left_chest":    f"{MOCKUP_BASE}/shirt-black-front.png",
                    "center_chest":  f"{MOCKUP_BASE}/shirt-black-front.png",
                    "right_chest":   f"{MOCKUP_BASE}/shirt-black-front.png",
                    "full_back":     f"{MOCKUP_BASE}/shirt-black-back.png",
                },
            },
        ],
        sizes=["S", "M", "L", "XL", "XXL"],
    )
    db.add(shirt)
    db.flush()

    zones = [
        PlacementZone(product_id=shirt.id, name="left_chest",   add_on_price=8.00,  max_width_mm=80,  max_height_mm=80,  position_on_mockup={"x": 95,  "y": 120, "w": 80, "h": 80}),
        PlacementZone(product_id=shirt.id, name="center_chest", add_on_price=12.00, max_width_mm=120, max_height_mm=100, position_on_mockup={"x": 75,  "y": 155, "w": 120, "h": 100}),
        PlacementZone(product_id=shirt.id, name="right_chest",  add_on_price=8.00,  max_width_mm=80,  max_height_mm=80,  position_on_mockup={"x": 155, "y": 120, "w": 80, "h": 80}),
        PlacementZone(product_id=shirt.id, name="full_back",    add_on_price=18.00, max_width_mm=200, max_height_mm=250, position_on_mockup={"x": 50,  "y": 80,  "w": 200, "h": 250}),
    ]
    db.add_all(zones)
    db.commit()
    print(f"Seeded product: {shirt.id}")

if __name__ == "__main__":
    seed()
```

- [ ] **Step 5: Write failing test**

Create `backend/tests/test_products.py`:
```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_list_products_returns_200():
    response = client.get("/products/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_get_product_not_found():
    response = client.get("/products/does-not-exist")
    assert response.status_code == 404

def test_get_seeded_product_has_zones():
    products = client.get("/products/").json()
    assert len(products) > 0
    product = products[0]
    assert len(product["zones"]) == 4
    zone_names = [z["name"] for z in product["zones"]]
    assert "left_chest" in zone_names
    assert "full_back" in zone_names
```

- [ ] **Step 6: Run seed then tests**

```bash
docker compose run --rm fastapi bash -c "python seed.py"
docker compose run --rm fastapi bash -c "pytest tests/test_products.py -v"
```

Expected: 3 tests PASSED

- [ ] **Step 7: Commit**

```bash
git add backend/schemas.py backend/routers/ backend/main.py backend/seed.py backend/tests/test_products.py
git commit -m "feat: products API with seed data"
```

---

## Task 4: File Upload API + S3 Storage

**Files:**
- Create: `backend/storage.py`
- Create: `backend/routers/uploads.py`
- Modify: `backend/schemas.py`
- Modify: `backend/main.py`
- Create: `backend/tests/test_uploads.py`

- [ ] **Step 1: Write `backend/storage.py`**

```python
import boto3
import os
import uuid

s3 = boto3.client(
    "s3",
    region_name=os.getenv("AWS_REGION", "us-east-1"),
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
)
BUCKET = os.getenv("AWS_S3_BUCKET", "embi-print")

def upload_file(file_bytes: bytes, filename: str, content_type: str) -> str:
    """Upload file to S3 and return the S3 key."""
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
    key = f"uploads/{uuid.uuid4()}.{ext}"
    s3.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
    )
    return key

def get_presigned_url(key: str, expires: int = 3600) -> str:
    """Return a temporary URL for a private S3 object."""
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET, "Key": key},
        ExpiresIn=expires,
    )
```

- [ ] **Step 2: Add upload schemas to `backend/schemas.py`**

Append to the file:
```python
class UploadOut(BaseModel):
    id: str
    status: str
    stitch_count: int | None
    original_filename: str

    model_config = {"from_attributes": True}
```

- [ ] **Step 3: Write `backend/routers/uploads.py`**

```python
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Upload, UploadStatus
from schemas import UploadOut
from storage import upload_file
from worker import run_dst_conversion

ALLOWED_TYPES = {"image/png", "image/jpeg", "image/svg+xml", "application/pdf"}
MAX_BYTES = 10 * 1024 * 1024  # 10MB

router = APIRouter(prefix="/uploads", tags=["uploads"])

@router.post("/", response_model=UploadOut, status_code=201)
async def create_upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(400, "File exceeds 10MB limit")

    s3_key = upload_file(data, file.filename, file.content_type)
    upload = Upload(
        s3_key=s3_key,
        original_filename=file.filename,
        mime_type=file.content_type,
        status=UploadStatus.pending,
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    run_dst_conversion.delay(upload.id)
    return upload

@router.get("/{upload_id}", response_model=UploadOut)
def get_upload(upload_id: str, db: Session = Depends(get_db)):
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        raise HTTPException(404, "Upload not found")
    return upload
```

- [ ] **Step 4: Register uploads router in `backend/main.py`**

```python
from routers import products, uploads

# after existing include_router line:
app.include_router(uploads.router)
```

- [ ] **Step 5: Write failing tests**

Create `backend/tests/test_uploads.py`:
```python
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def _fake_upload(data, filename, content_type):
    return "uploads/fake-key.png"

def _fake_delay(upload_id):
    pass

@patch("routers.uploads.upload_file", side_effect=_fake_upload)
@patch("routers.uploads.run_dst_conversion")
def test_upload_png_returns_201(mock_task, mock_s3):
    mock_task.delay = _fake_delay
    response = client.post(
        "/uploads/",
        files={"file": ("logo.png", b"fakepngdata", "image/png")},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert body["original_filename"] == "logo.png"

@patch("routers.uploads.upload_file", side_effect=_fake_upload)
@patch("routers.uploads.run_dst_conversion")
def test_upload_invalid_type_returns_400(mock_task, mock_s3):
    mock_task.delay = _fake_delay
    response = client.post(
        "/uploads/",
        files={"file": ("virus.exe", b"MZ", "application/octet-stream")},
    )
    assert response.status_code == 400

@patch("routers.uploads.upload_file", side_effect=_fake_upload)
@patch("routers.uploads.run_dst_conversion")
def test_get_upload_returns_status(mock_task, mock_s3):
    mock_task.delay = _fake_delay
    create_resp = client.post(
        "/uploads/",
        files={"file": ("logo.png", b"fakepngdata", "image/png")},
    )
    upload_id = create_resp.json()["id"]
    get_resp = client.get(f"/uploads/{upload_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == upload_id
```

- [ ] **Step 6: Run tests (expect failure — worker not yet written)**

```bash
docker compose run --rm fastapi bash -c "pytest tests/test_uploads.py -v"
```

Expected: ImportError on `worker.run_dst_conversion` — that's the signal to write Task 5.

- [ ] **Step 7: Commit scaffolding**

```bash
git add backend/storage.py backend/routers/uploads.py backend/schemas.py backend/main.py backend/tests/test_uploads.py
git commit -m "feat: upload API + S3 storage scaffold"
```

---

## Task 5: Celery Worker + DST Conversion Job

**Files:**
- Create: `backend/worker.py`
- Create: `backend/tests/test_worker.py`

- [ ] **Step 1: Write `backend/worker.py`**

```python
import os
import tempfile
import subprocess
from pathlib import Path
from celery import Celery
from sqlalchemy.orm import Session

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
celery_app = Celery("embi", broker=REDIS_URL, backend=REDIS_URL)

@celery_app.task(name="run_dst_conversion")
def run_dst_conversion(upload_id: str):
    from database import SessionLocal
    from models import Upload, UploadStatus
    from storage import get_presigned_url, upload_file
    import boto3

    db: Session = SessionLocal()
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        return

    upload.status = UploadStatus.processing
    db.commit()

    try:
        s3 = boto3.client(
            "s3",
            region_name=os.getenv("AWS_REGION", "us-east-1"),
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        )
        bucket = os.getenv("AWS_S3_BUCKET", "embi-print")

        with tempfile.TemporaryDirectory() as work_dir:
            work = Path(work_dir)
            input_path = work / "input.png"

            # Download original from S3
            s3.download_file(bucket, upload.s3_key, str(input_path))

            # Run convert.py pipeline
            result = subprocess.run(
                ["python3", "/app/convert.py", str(input_path)],
                env={**os.environ, "WORK_DIR": work_dir},
                capture_output=True,
                text=True,
            )

            dst_path = work / "output.dst"
            if result.returncode != 0 or not dst_path.exists():
                raise RuntimeError(f"convert.py failed: {result.stderr}")

            # Parse stitch count from stdout
            stitch_count = None
            for line in result.stdout.splitlines():
                if "stitches" in line:
                    parts = line.split()
                    for i, p in enumerate(parts):
                        if p == "stitches" and i > 0:
                            try:
                                stitch_count = int(parts[i - 1].replace(",", ""))
                            except ValueError:
                                pass

            # Upload DST to S3
            dst_key = upload.s3_key.replace("uploads/", "dst/").replace(".png", ".dst")
            with open(dst_path, "rb") as f:
                s3.put_object(Bucket=bucket, Key=dst_key, Body=f.read())

        upload.dst_s3_key = dst_key
        upload.stitch_count = stitch_count
        upload.status = UploadStatus.done
        db.commit()

    except Exception as e:
        upload.status = UploadStatus.failed
        db.commit()
        raise
    finally:
        db.close()
```

- [ ] **Step 2: Update `convert.py` to respect `WORK_DIR` env var**

In `backend/convert.py`, change line 16:
```python
# Old:
workdir = Path("/work")
# New:
workdir = Path(os.environ.get("WORK_DIR", "/work"))
```

Add `import os` at the top if not present.

- [ ] **Step 3: Write failing test**

Create `backend/tests/test_worker.py`:
```python
from unittest.mock import patch, MagicMock, call
import pytest

def test_run_dst_conversion_marks_done_on_success():
    """Worker sets status=done and stitch_count when pipeline succeeds."""
    from worker import run_dst_conversion

    mock_upload = MagicMock()
    mock_upload.id = "test-id"
    mock_upload.s3_key = "uploads/fake.png"

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = mock_upload

    with patch("worker.SessionLocal", return_value=mock_db), \
         patch("worker.boto3.client") as mock_boto, \
         patch("worker.subprocess.run") as mock_sub, \
         patch("builtins.open", MagicMock()), \
         patch("worker.Path.exists", return_value=True):

        mock_sub.return_value = MagicMock(
            returncode=0,
            stdout="DONE: output.dst (max dimension: 10cm, 4200 stitches)",
            stderr="",
        )

        run_dst_conversion("test-id")

    assert mock_upload.status.value == "done" or str(mock_upload.status) in ("done", "UploadStatus.done")
    assert mock_db.commit.called

def test_run_dst_conversion_marks_failed_on_error():
    from worker import run_dst_conversion

    mock_upload = MagicMock()
    mock_upload.id = "test-id"
    mock_upload.s3_key = "uploads/fake.png"

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = mock_upload

    with patch("worker.SessionLocal", return_value=mock_db), \
         patch("worker.boto3.client") as mock_boto, \
         patch("worker.subprocess.run") as mock_sub:

        mock_sub.return_value = MagicMock(returncode=1, stdout="", stderr="potrace failed")
        mock_boto.return_value.download_file = MagicMock()

        with pytest.raises(RuntimeError):
            run_dst_conversion("test-id")

    assert str(mock_upload.status) in ("failed", "UploadStatus.failed")
```

- [ ] **Step 4: Run tests**

```bash
docker compose run --rm fastapi bash -c "pytest tests/test_worker.py tests/test_uploads.py -v"
```

Expected: all PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/worker.py backend/convert.py backend/tests/test_worker.py
git commit -m "feat: Celery DST conversion worker"
```

---

## Task 6: Orders API

**Files:**
- Create: `backend/routers/orders.py`
- Modify: `backend/schemas.py`
- Modify: `backend/main.py`
- Create: `backend/tests/test_orders.py`

- [ ] **Step 1: Add order schemas to `backend/schemas.py`**

Append:
```python
class ShippingAddress(BaseModel):
    line1: str
    line2: str = ""
    city: str
    state: str
    postal_code: str
    country: str = "US"

class OrderItemIn(BaseModel):
    product_id: str
    zone_id: str
    upload_id: str
    size: str
    color: str
    quantity: int = 1

class OrderIn(BaseModel):
    customer_email: str
    customer_name: str
    shipping_address: ShippingAddress
    items: list[OrderItemIn]

class OrderItemOut(BaseModel):
    id: str
    product_id: str
    zone_id: str
    upload_id: str
    size: str
    color: str
    quantity: int
    unit_price: float
    model_config = {"from_attributes": True}

class OrderOut(BaseModel):
    id: str
    status: str
    customer_email: str
    total_price: float
    stripe_payment_intent_id: str | None
    stripe_client_secret: str | None = None  # returned on create only
    items: list[OrderItemOut]
    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Write `backend/routers/orders.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Order, OrderItem, Product, PlacementZone, Upload, UploadStatus
from schemas import OrderIn, OrderOut
from services.stripe_service import create_payment_intent

router = APIRouter(prefix="/orders", tags=["orders"])

@router.post("/", response_model=OrderOut, status_code=201)
def create_order(payload: OrderIn, db: Session = Depends(get_db)):
    total = 0.0
    items_data = []

    for item in payload.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(400, f"Product {item.product_id} not found")
        zone = db.query(PlacementZone).filter(PlacementZone.id == item.zone_id).first()
        if not zone:
            raise HTTPException(400, f"Zone {item.zone_id} not found")
        upload = db.query(Upload).filter(Upload.id == item.upload_id).first()
        if not upload or upload.status == UploadStatus.failed:
            raise HTTPException(400, f"Upload {item.upload_id} not ready")

        unit_price = float(product.base_price) + float(zone.add_on_price)
        total += unit_price * item.quantity
        items_data.append((item, unit_price))

    order = Order(
        customer_email=payload.customer_email,
        customer_name=payload.customer_name,
        shipping_address=payload.shipping_address.model_dump(),
        total_price=round(total, 2),
    )
    db.add(order)
    db.flush()

    for item, unit_price in items_data:
        db.add(OrderItem(
            order_id=order.id,
            product_id=item.product_id,
            zone_id=item.zone_id,
            upload_id=item.upload_id,
            size=item.size,
            color=item.color,
            quantity=item.quantity,
            unit_price=unit_price,
        ))

    intent = create_payment_intent(int(total * 100), order.id)
    order.stripe_payment_intent_id = intent["id"]
    db.commit()
    db.refresh(order)
    # Attach client_secret to response (not stored in DB — Stripe holds it)
    out = OrderOut.model_validate(order)
    out.stripe_client_secret = intent["client_secret"]
    return out

@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    return order
```

- [ ] **Step 3: Write `backend/services/stripe_service.py`** (stub for now)

```python
import os
import stripe

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")

def create_payment_intent(amount_cents: int, order_id: str) -> dict:
    intent = stripe.PaymentIntent.create(
        amount=amount_cents,
        currency="usd",
        metadata={"order_id": order_id},
    )
    return {"id": intent.id, "client_secret": intent.client_secret}
```

- [ ] **Step 4: Register orders router in `backend/main.py`**

```python
from routers import products, uploads, orders

app.include_router(orders.router)
```

- [ ] **Step 5: Write failing tests**

Create `backend/tests/test_orders.py`:
```python
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def _fake_intent(amount_cents, order_id):
    return {"id": "pi_fake", "client_secret": "secret_fake"}

@patch("routers.orders.create_payment_intent", side_effect=_fake_intent)
def test_create_order(mock_stripe):
    # First get a real product + zone + upload from DB
    products = client.get("/products/").json()
    assert len(products) > 0
    product = products[0]
    zone = product["zones"][0]

    # Create a fake upload
    with patch("routers.uploads.upload_file", return_value="uploads/fake.png"), \
         patch("routers.uploads.run_dst_conversion") as mock_task:
        mock_task.delay = lambda x: None
        upload_resp = client.post(
            "/uploads/",
            files={"file": ("logo.png", b"fake", "image/png")},
        )
    upload_id = upload_resp.json()["id"]

    payload = {
        "customer_email": "test@example.com",
        "customer_name": "Test User",
        "shipping_address": {
            "line1": "123 Main St",
            "city": "New York",
            "state": "NY",
            "postal_code": "10001",
            "country": "US",
        },
        "items": [{
            "product_id": product["id"],
            "zone_id": zone["id"],
            "upload_id": upload_id,
            "size": "M",
            "color": "White",
            "quantity": 1,
        }],
    }
    resp = client.post("/orders/", json=payload)
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "pending"
    assert body["stripe_payment_intent_id"] == "pi_fake"
    assert body["total_price"] == float(product["base_price"]) + float(zone["add_on_price"])
```

- [ ] **Step 6: Run tests**

```bash
docker compose run --rm fastapi bash -c "pytest tests/test_orders.py -v"
```

Expected: PASSED

- [ ] **Step 7: Commit**

```bash
git add backend/routers/orders.py backend/schemas.py backend/main.py backend/services/stripe_service.py backend/tests/test_orders.py
git commit -m "feat: orders API with Stripe PaymentIntent creation"
```

---

## Task 7: Stripe + Printful Webhooks

**Files:**
- Create: `backend/routers/webhooks.py`
- Create: `backend/services/printful.py`
- Create: `backend/services/email.py`
- Modify: `backend/main.py`
- Create: `backend/tests/test_webhooks.py`

- [ ] **Step 1: Write `backend/services/printful.py`**

```python
import os
import httpx

PRINTFUL_API_URL = "https://api.printful.com"
PRINTFUL_ZONE_MAP = {
    "left_chest":   "embroidery_chest_left",
    "right_chest":  "embroidery_chest_right",
    "center_chest": "embroidery_chest_center",
    "full_back":    "embroidery_back_large",
}
# Printful variant IDs for Gildan 64000 t-shirt (example IDs — replace with real ones)
PRINTFUL_VARIANT_MAP = {
    ("White", "S"): 4011, ("White", "M"): 4012, ("White", "L"): 4013,
    ("White", "XL"): 4014, ("White", "XXL"): 4015,
    ("Black", "S"): 4016, ("Black", "M"): 4017, ("Black", "L"): 4018,
    ("Black", "XL"): 4019, ("Black", "XXL"): 4020,
}

def submit_order(order, items, db) -> str:
    """Submit a paid order to Printful and return the Printful order ID."""
    from models import Upload, PlacementZone
    from storage import get_presigned_url

    printful_items = []
    for item in items:
        zone = db.query(PlacementZone).filter(PlacementZone.id == item.zone_id).first()
        upload = db.query(Upload).filter(Upload.id == item.upload_id).first()
        image_url = get_presigned_url(upload.s3_key, expires=3600)
        variant_id = PRINTFUL_VARIANT_MAP.get((item.color, item.size))
        printful_items.append({
            "variant_id": variant_id,
            "quantity": item.quantity,
            "files": [{
                "type": PRINTFUL_ZONE_MAP.get(zone.name, "embroidery_chest_left"),
                "url": image_url,
            }],
        })

    addr = order.shipping_address
    payload = {
        "recipient": {
            "name": order.customer_name,
            "address1": addr["line1"],
            "address2": addr.get("line2", ""),
            "city": addr["city"],
            "state_code": addr["state"],
            "zip": addr["postal_code"],
            "country_code": addr.get("country", "US"),
            "email": order.customer_email,
        },
        "items": printful_items,
    }

    resp = httpx.post(
        f"{PRINTFUL_API_URL}/orders",
        json=payload,
        headers={"Authorization": f"Bearer {os.getenv('PRINTFUL_API_KEY')}"},
        timeout=30,
    )
    resp.raise_for_status()
    return str(resp.json()["result"]["id"])
```

- [ ] **Step 2: Write `backend/services/email.py`**

```python
import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

def send_order_confirmation(to_email: str, customer_name: str, order_id: str):
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    message = Mail(
        from_email="noreply@embiprint.com",
        to_emails=to_email,
        subject="Your embi_print order is confirmed!",
        html_content=f"""
        <p>Hi {customer_name},</p>
        <p>Your order <strong>#{order_id[:8]}</strong> has been confirmed and sent to production.</p>
        <p>We'll email you again when it ships.</p>
        <p>Thanks for ordering from embi_print!</p>
        """,
    )
    sg = SendGridAPIClient(os.getenv("SENDGRID_API_KEY"))
    sg.send(message)
```

- [ ] **Step 3: Write `backend/routers/webhooks.py`**

```python
import os
import stripe
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Order, OrderStatus

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

@router.post("/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig, secret)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Invalid signature")

    if event["type"] == "payment_intent.succeeded":
        intent = event["data"]["object"]
        order_id = intent["metadata"].get("order_id")
        order = db.query(Order).filter(Order.id == order_id).first()
        if order and order.status == OrderStatus.pending:
            from services.printful import submit_order
            from services.email import send_order_confirmation
            printful_id = submit_order(order, order.items, db)
            order.printful_order_id = printful_id
            order.status = OrderStatus.submitted_to_printful
            db.commit()
            send_order_confirmation(order.customer_email, order.customer_name, order.id)

    return {"received": True}

@router.post("/printful")
async def printful_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    event_type = body.get("type")

    if event_type == "package_shipped":
        printful_order_id = str(body["data"]["order"]["id"])
        tracking = body["data"]["shipment"].get("tracking_number", "")
        order = db.query(Order).filter(Order.printful_order_id == printful_order_id).first()
        if order:
            order.status = OrderStatus.shipped
            order.tracking_number = tracking
            db.commit()

    return {"received": True}
```

- [ ] **Step 4: Register webhooks router in `backend/main.py`**

```python
from routers import products, uploads, orders, webhooks

app.include_router(webhooks.router)
```

- [ ] **Step 5: Write failing tests**

Create `backend/tests/test_webhooks.py`:
```python
import json
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Order, OrderItem, OrderStatus
from main import app

client = TestClient(app)

@pytest.fixture
def test_db_order():
    """Insert a minimal pending order directly into the DB for webhook tests."""
    db: Session = SessionLocal()
    order = Order(
        customer_email="test@example.com",
        customer_name="Test User",
        shipping_address={"line1": "123 Main", "city": "NY", "state": "NY", "postal_code": "10001", "country": "US"},
        stripe_payment_intent_id="pi_test_123",
        total_price=28.00,
        status=OrderStatus.pending,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    yield order
    db.delete(order)
    db.commit()
    db.close()

def test_stripe_webhook_invalid_signature_returns_400():
    response = client.post(
        "/webhooks/stripe",
        content=b"{}",
        headers={"stripe-signature": "bad-sig"},
    )
    assert response.status_code == 400

@patch("routers.webhooks.stripe.Webhook.construct_event")
@patch("routers.webhooks.submit_order", return_value="pf_123")
@patch("routers.webhooks.send_order_confirmation")
def test_stripe_webhook_payment_succeeded_submits_to_printful(
    mock_email, mock_printful, mock_event, test_db_order
):
    mock_event.return_value = {
        "type": "payment_intent.succeeded",
        "data": {"object": {"metadata": {"order_id": test_db_order.id}}},
    }
    response = client.post(
        "/webhooks/stripe",
        content=b"{}",
        headers={"stripe-signature": "valid"},
    )
    assert response.status_code == 200
    mock_printful.assert_called_once()
    mock_email.assert_called_once()

def test_printful_webhook_shipped_updates_order(test_db_order):
    # Set a printful_order_id on the test order
    db: Session = SessionLocal()
    order = db.query(Order).filter(Order.id == test_db_order.id).first()
    order.printful_order_id = "9999"
    order.status = OrderStatus.submitted_to_printful
    db.commit()
    db.close()

    body = {
        "type": "package_shipped",
        "data": {
            "order": {"id": 9999},
            "shipment": {"tracking_number": "1Z999AA1"},
        },
    }
    response = client.post("/webhooks/printful", json=body)
    assert response.status_code == 200

    db = SessionLocal()
    updated = db.query(Order).filter(Order.id == test_db_order.id).first()
    assert updated.status == OrderStatus.shipped
    assert updated.tracking_number == "1Z999AA1"
    db.close()
```

- [ ] **Step 6: Run tests**

```bash
docker compose run --rm fastapi bash -c "pytest tests/test_webhooks.py::test_stripe_webhook_invalid_signature_returns_400 -v"
```

Expected: PASSED (the signature test doesn't need DB fixtures)

- [ ] **Step 7: Commit**

```bash
git add backend/routers/webhooks.py backend/services/ backend/main.py backend/tests/test_webhooks.py
git commit -m "feat: Stripe and Printful webhook handlers"
```

---

## Task 8: Next.js Project Setup

**Files:**
- Create: `frontend/` (bootstrapped via create-next-app)
- Create: `frontend/lib/types.ts`
- Create: `frontend/lib/api.ts`
- Create: `frontend/Dockerfile`

- [ ] **Step 1: Bootstrap Next.js app**

```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```

Answer prompts: TypeScript=Yes, Tailwind=Yes, ESLint=Yes, App Router=Yes, src/=No, alias=`@/*`

- [ ] **Step 2: Install additional dependencies**

```bash
cd frontend
npm install @stripe/stripe-js @stripe/react-stripe-js
```

- [ ] **Step 3: Write `frontend/lib/types.ts`**

```typescript
export interface PlacementZone {
  id: string;
  name: "left_chest" | "center_chest" | "right_chest" | "full_back";
  add_on_price: number;
  max_width_mm: number;
  max_height_mm: number;
  position_on_mockup: { x: number; y: number; w: number; h: number };
}

export interface ProductColor {
  name: string;
  hex: string;
  mockup_images: {
    left_chest: string;
    center_chest: string;
    right_chest: string;
    full_back: string;
  };
}

export interface Product {
  id: string;
  name: string;
  type: string;
  base_price: number;
  colors: ProductColor[];
  sizes: string[];
  zones: PlacementZone[];
}

export interface Upload {
  id: string;
  status: "pending" | "processing" | "done" | "failed";
  stitch_count: number | null;
  original_filename: string;
}

export interface OrderItem {
  product_id: string;
  zone_id: string;
  upload_id: string;
  size: string;
  color: string;
  quantity: number;
}

export interface OrderPayload {
  customer_email: string;
  customer_name: string;
  shipping_address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  items: OrderItem[];
}

export interface Order {
  id: string;
  status: string;
  customer_email: string;
  total_price: number;
  stripe_payment_intent_id: string | null;
  items: OrderItem[];
}
```

- [ ] **Step 4: Write `frontend/lib/api.ts`**

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

export const api = {
  getProducts: () => apiFetch<import("./types").Product[]>("/products/"),

  getProduct: (id: string) =>
    apiFetch<import("./types").Product>(`/products/${id}`),

  uploadLogo: async (file: File): Promise<import("./types").Upload> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_URL}/uploads/`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`Upload failed: ${await res.text()}`);
    return res.json();
  },

  pollUpload: (id: string) =>
    apiFetch<import("./types").Upload>(`/uploads/${id}`),

  createOrder: (payload: import("./types").OrderPayload) =>
    apiFetch<import("./types").Order>("/orders/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
```

- [ ] **Step 5: Write `frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

- [ ] **Step 6: Verify Next.js starts**

```bash
cd frontend && npm run dev
```

Open http://localhost:3000 — should see the default Next.js page.

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: Next.js project setup with typed API client"
```

---

## Task 9: Product Listing Page

**Files:**
- Modify: `frontend/app/page.tsx`
- Create: `frontend/components/ProductCard.tsx`
- Create: `frontend/components/__tests__/ProductCard.test.tsx`

- [ ] **Step 1: Write `frontend/components/ProductCard.tsx`**

```tsx
import Link from "next/link";
import { Product } from "@/lib/types";

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  const firstColor = product.colors[0];
  const mockupUrl = firstColor?.mockup_images.left_chest;

  return (
    <Link href={`/products/${product.id}`} className="block border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      {mockupUrl && (
        <img
          src={mockupUrl}
          alt={product.name}
          className="w-full h-64 object-cover"
        />
      )}
      <div className="p-4">
        <h2 className="font-semibold text-lg">{product.name}</h2>
        <p className="text-gray-600 text-sm mt-1">From ${product.base_price.toFixed(2)}</p>
        <p className="text-gray-400 text-xs mt-1">{product.colors.length} colors · {product.sizes.length} sizes</p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Write `frontend/app/page.tsx`**

```tsx
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";

export default async function HomePage() {
  const products = await api.getProducts();

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">Custom Embroidery</h1>
      <p className="text-gray-500 mb-8">Upload your logo. We'll stitch it on.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Write failing test**

Create `frontend/components/__tests__/ProductCard.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import ProductCard from "../ProductCard";
import { Product } from "@/lib/types";

const mockProduct: Product = {
  id: "p1",
  name: "Classic T-Shirt",
  type: "shirt",
  base_price: 20,
  colors: [{ name: "White", hex: "#fff", mockup_images: { left_chest: "/mock.png", center_chest: "/mock.png", right_chest: "/mock.png", full_back: "/mock.png" } }],
  sizes: ["S", "M", "L"],
  zones: [],
};

test("renders product name and price", () => {
  render(<ProductCard product={mockProduct} />);
  expect(screen.getByText("Classic T-Shirt")).toBeInTheDocument();
  expect(screen.getByText("From $20.00")).toBeInTheDocument();
});
```

- [ ] **Step 4: Install test dependencies and run**

```bash
cd frontend
npm install --save-dev @testing-library/react @testing-library/jest-dom jest jest-environment-jsdom @types/jest ts-jest
npx jest components/__tests__/ProductCard.test.tsx
```

Expected: PASSED

- [ ] **Step 5: Commit**

```bash
git add frontend/app/page.tsx frontend/components/ProductCard.tsx frontend/components/__tests__/
git commit -m "feat: product listing homepage"
```

---

## Task 10: MockupCanvas Component

**Files:**
- Create: `frontend/components/MockupCanvas.tsx`
- Create: `frontend/components/__tests__/MockupCanvas.test.tsx`

- [ ] **Step 1: Write `frontend/components/MockupCanvas.tsx`**

```tsx
"use client";
import { useEffect, useRef } from "react";
import { PlacementZone, ProductColor } from "@/lib/types";

interface Props {
  color: ProductColor;
  zone: PlacementZone | null;
  logoDataUrl: string | null;
  stitchCount: number | null;
}

const MOCKUP_WIDTH = 400;
const MOCKUP_HEIGHT = 480;

export default function MockupCanvas({ color, zone, logoDataUrl, stitchCount }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mockupUrl = zone ? color.mockup_images[zone.name] : color.mockup_images.left_chest;
    const shirt = new Image();
    shirt.crossOrigin = "anonymous";
    shirt.src = mockupUrl;
    shirt.onload = () => {
      ctx.clearRect(0, 0, MOCKUP_WIDTH, MOCKUP_HEIGHT);
      ctx.drawImage(shirt, 0, 0, MOCKUP_WIDTH, MOCKUP_HEIGHT);

      if (zone && logoDataUrl) {
        const pos = zone.position_on_mockup;
        const scaleX = MOCKUP_WIDTH / 400;  // mockup images are 400px wide
        const scaleY = MOCKUP_HEIGHT / 480;
        const logo = new Image();
        logo.src = logoDataUrl;
        logo.onload = () => {
          ctx.globalAlpha = 0.85;
          ctx.drawImage(logo, pos.x * scaleX, pos.y * scaleY, pos.w * scaleX, pos.h * scaleY);
          ctx.globalAlpha = 1.0;
        };
      } else if (zone) {
        // Draw dashed zone indicator
        const pos = zone.position_on_mockup;
        const scaleX = MOCKUP_WIDTH / 400;
        const scaleY = MOCKUP_HEIGHT / 480;
        ctx.setLineDash([6, 3]);
        ctx.strokeStyle = "rgba(99,102,241,0.7)";
        ctx.lineWidth = 2;
        ctx.strokeRect(pos.x * scaleX, pos.y * scaleY, pos.w * scaleX, pos.h * scaleY);
      }
    };
  }, [color, zone, logoDataUrl]);

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas
        ref={canvasRef}
        width={MOCKUP_WIDTH}
        height={MOCKUP_HEIGHT}
        className="rounded-lg border"
      />
      {stitchCount && (
        <p className="text-sm text-green-600">~{stitchCount.toLocaleString()} stitches estimated</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write failing test**

Create `frontend/components/__tests__/MockupCanvas.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import MockupCanvas from "../MockupCanvas";
import { ProductColor, PlacementZone } from "@/lib/types";

const mockColor: ProductColor = {
  name: "White", hex: "#fff",
  mockup_images: { left_chest: "/mock.png", center_chest: "/mock.png", right_chest: "/mock.png", full_back: "/mock.png" },
};

const mockZone: PlacementZone = {
  id: "z1", name: "left_chest", add_on_price: 8, max_width_mm: 80, max_height_mm: 80,
  position_on_mockup: { x: 95, y: 120, w: 80, h: 80 },
};

test("renders canvas element", () => {
  render(<MockupCanvas color={mockColor} zone={mockZone} logoDataUrl={null} stitchCount={null} />);
  expect(document.querySelector("canvas")).toBeInTheDocument();
});

test("shows stitch count when provided", () => {
  render(<MockupCanvas color={mockColor} zone={mockZone} logoDataUrl={null} stitchCount={4200} />);
  expect(screen.getByText(/4,200 stitches estimated/)).toBeInTheDocument();
});
```

- [ ] **Step 3: Run tests**

```bash
cd frontend && npx jest components/__tests__/MockupCanvas.test.tsx
```

Expected: 2 PASSED

- [ ] **Step 4: Commit**

```bash
git add frontend/components/MockupCanvas.tsx frontend/components/__tests__/MockupCanvas.test.tsx
git commit -m "feat: MockupCanvas component with live logo overlay"
```

---

## Task 11: Customizer Page (Product Detail)

**Files:**
- Create: `frontend/components/ZonePicker.tsx`
- Create: `frontend/components/LogoUploader.tsx`
- Create: `frontend/components/PriceBreakdown.tsx`
- Create: `frontend/app/products/[id]/page.tsx`

- [ ] **Step 1: Write `frontend/components/ZonePicker.tsx`**

```tsx
import { PlacementZone } from "@/lib/types";

const ZONE_LABELS: Record<string, string> = {
  left_chest: "Left Chest",
  center_chest: "Center Chest",
  right_chest: "Right Chest",
  full_back: "Full Back",
};

interface Props {
  zones: PlacementZone[];
  selected: PlacementZone | null;
  onSelect: (zone: PlacementZone) => void;
}

export default function ZonePicker({ zones, selected, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {zones.map((zone) => (
        <button
          key={zone.id}
          onClick={() => onSelect(zone)}
          className={`px-3 py-1.5 text-sm rounded border transition-colors ${
            selected?.id === zone.id
              ? "border-indigo-500 bg-indigo-50 text-indigo-700"
              : "border-gray-300 hover:border-gray-400"
          }`}
        >
          {ZONE_LABELS[zone.name]} +${zone.add_on_price.toFixed(2)}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write `frontend/components/LogoUploader.tsx`**

```tsx
"use client";
import { useRef, useState } from "react";
import { Upload } from "@/lib/types";
import { api } from "@/lib/api";

interface Props {
  onUploadComplete: (upload: Upload, dataUrl: string) => void;
}

export default function LogoUploader({ onUploadComplete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "polling" | "done" | "error">("idle");
  const [filename, setFilename] = useState("");

  const handleFile = async (file: File) => {
    setStatus("uploading");
    setFilename(file.name);

    // Read data URL for canvas preview
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });

    try {
      const upload = await api.uploadLogo(file);
      setStatus("polling");

      // Poll until DST conversion finishes (or timeout after 60s)
      const start = Date.now();
      let resolved = upload;
      while (resolved.status === "pending" || resolved.status === "processing") {
        if (Date.now() - start > 60000) break;
        await new Promise((r) => setTimeout(r, 2000));
        resolved = await api.pollUpload(upload.id);
      }

      setStatus("done");
      onUploadComplete(resolved, dataUrl);
    } catch {
      setStatus("error");
    }
  };

  return (
    <div
      className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-indigo-400 transition-colors"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
    >
      <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.svg,.pdf,.ai" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      {status === "idle" && <p className="text-gray-500 text-sm">Drag & drop or click to upload<br /><span className="text-xs">PNG, JPG, SVG, AI · Max 10MB</span></p>}
      {status === "uploading" && <p className="text-blue-600 text-sm">Uploading {filename}...</p>}
      {status === "polling" && <p className="text-yellow-600 text-sm">Processing {filename}... estimating stitches</p>}
      {status === "done" && <p className="text-green-600 text-sm">✓ {filename} ready</p>}
      {status === "error" && <p className="text-red-600 text-sm">Upload failed — try again</p>}
    </div>
  );
}
```

- [ ] **Step 3: Write `frontend/components/PriceBreakdown.tsx`**

```tsx
interface Props {
  basePrice: number;
  zoneAddOn: number | null;
}

export default function PriceBreakdown({ basePrice, zoneAddOn }: Props) {
  const total = basePrice + (zoneAddOn ?? 0);
  return (
    <div className="border rounded-lg p-4 text-sm space-y-1">
      <div className="flex justify-between text-gray-600">
        <span>Base shirt</span>
        <span>${basePrice.toFixed(2)}</span>
      </div>
      {zoneAddOn != null && (
        <div className="flex justify-between text-gray-600">
          <span>Placement zone</span>
          <span>+${zoneAddOn.toFixed(2)}</span>
        </div>
      )}
      <div className="flex justify-between font-semibold pt-2 border-t">
        <span>Total</span>
        <span className="text-green-700">${total.toFixed(2)}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `frontend/app/products/[id]/page.tsx`**

```tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Product, PlacementZone, ProductColor, Upload } from "@/lib/types";
import MockupCanvas from "@/components/MockupCanvas";
import ZonePicker from "@/components/ZonePicker";
import LogoUploader from "@/components/LogoUploader";
import PriceBreakdown from "@/components/PriceBreakdown";

export default function ProductPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedColor, setSelectedColor] = useState<ProductColor | null>(null);
  const [selectedZone, setSelectedZone] = useState<PlacementZone | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [upload, setUpload] = useState<Upload | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  useEffect(() => {
    api.getProduct(params.id).then((p) => {
      setProduct(p);
      setSelectedColor(p.colors[0]);
      setSelectedZone(p.zones[0]);
    });
  }, [params.id]);

  const canCheckout = !!upload && upload.status !== "failed" && !!selectedZone && !!selectedSize && !!selectedColor;

  const handleCheckout = () => {
    if (!product || !selectedColor || !selectedZone || !selectedSize || !upload) return;
    const config = encodeURIComponent(JSON.stringify({
      product_id: product.id,
      zone_id: selectedZone.id,
      upload_id: upload.id,
      size: selectedSize,
      color: selectedColor.name,
      unit_price: product.base_price + selectedZone.add_on_price,
    }));
    router.push(`/checkout?config=${config}`);
  };

  if (!product || !selectedColor) return <div className="p-8">Loading...</div>;

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-8">{product.name}</h1>
      <div className="flex flex-col lg:flex-row gap-10">

        {/* Left: mockup */}
        <div className="lg:w-1/2">
          <MockupCanvas
            color={selectedColor}
            zone={selectedZone}
            logoDataUrl={logoDataUrl}
            stitchCount={upload?.stitch_count ?? null}
          />
        </div>

        {/* Right: controls */}
        <div className="lg:w-1/2 space-y-6">
          {/* Step 1: Color */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">1. Color</p>
            <div className="flex gap-2">
              {product.colors.map((c) => (
                <button key={c.name} title={c.name} onClick={() => setSelectedColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${selectedColor.name === c.name ? "border-indigo-500 scale-110" : "border-gray-300"}`}
                  style={{ background: c.hex }} />
              ))}
            </div>
          </div>

          {/* Step 2: Zone */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">2. Placement Zone</p>
            <ZonePicker zones={product.zones} selected={selectedZone} onSelect={setSelectedZone} />
          </div>

          {/* Step 3: Upload */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">3. Upload Logo</p>
            <LogoUploader onUploadComplete={(u, url) => { setUpload(u); setLogoDataUrl(url); }} />
          </div>

          {/* Step 4: Size */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">4. Size</p>
            <div className="flex gap-2 flex-wrap">
              {product.sizes.map((s) => (
                <button key={s} onClick={() => setSelectedSize(s)}
                  className={`px-3 py-1.5 text-sm rounded border ${selectedSize === s ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-300"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Price + CTA */}
          <PriceBreakdown basePrice={product.base_price} zoneAddOn={selectedZone?.add_on_price ?? null} />
          <button onClick={handleCheckout} disabled={!canCheckout}
            className="w-full py-3 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Proceed to Checkout →
          </button>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Run dev server and manually test**

```bash
cd frontend && npm run dev
```

- Open http://localhost:3000, click a product, verify the customizer page loads
- Select a color, zone, size — verify canvas updates and price changes
- Upload a small PNG — verify status transitions (uploading → polling → done)

- [ ] **Step 6: Commit**

```bash
git add frontend/components/ZonePicker.tsx frontend/components/LogoUploader.tsx frontend/components/PriceBreakdown.tsx "frontend/app/products/[id]/page.tsx"
git commit -m "feat: product customizer page with live preview"
```

---

## Task 12: Checkout Page + Stripe Elements

**Files:**
- Create: `frontend/components/CheckoutForm.tsx`
- Create: `frontend/app/checkout/page.tsx`
- Create: `frontend/app/order-confirmation/page.tsx`

- [ ] **Step 1: Write `frontend/components/CheckoutForm.tsx`**

```tsx
"use client";
import { useState, FormEvent } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

interface Props {
  onSubmit: (fields: {
    customer_name: string;
    customer_email: string;
    shipping_address: {
      line1: string; city: string; state: string; postal_code: string; country: string;
    };
  }) => Promise<void>;
  loading: boolean;
}

export default function CheckoutForm({ onSubmit, loading }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError("");
    try {
      await onSubmit({
        customer_name: name,
        customer_email: email,
        shipping_address: { line1, city, state, postal_code: zip, country: "US" },
      });
    } catch (err: any) {
      setError(err.message || "Payment failed");
    }
  };

  const inputClass = "w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Full Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Email</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Street Address</label>
        <input required value={line1} onChange={(e) => setLine1(e.target.value)} className={inputClass} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">City</label>
          <input required value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">State</label>
          <input required value={state} onChange={(e) => setState(e.target.value)} className={inputClass} placeholder="NY" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">ZIP</label>
          <input required value={zip} onChange={(e) => setZip(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Card Details</label>
        <div className="border rounded p-3">
          <PaymentElement />
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button type="submit" disabled={!stripe || loading}
        className="w-full py-3 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors">
        {loading ? "Processing..." : "Pay Now"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Write `frontend/app/checkout/page.tsx`**

Two-step flow: collect shipping details first → create order to get `client_secret` → show Stripe Elements.

```tsx
"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { api } from "@/lib/api";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Step 2: shown after order is created and client_secret is known
function PaymentStep({ orderId, clientSecret }: { orderId: string; clientSecret: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setLoading(true);
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/order-confirmation?order_id=${orderId}`,
      },
    });
    if (stripeError) setError(stripeError.message ?? "Payment failed");
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">Payment</h2>
      <div className="border rounded p-4">
        <PaymentElement />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button onClick={handlePay} disabled={!stripe || loading}
        className="w-full py-3 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors">
        {loading ? "Processing..." : "Pay Now"}
      </button>
    </div>
  );
}

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const configRaw = searchParams.get("config");
  const config = configRaw ? JSON.parse(decodeURIComponent(configRaw)) : null;

  const [step, setStep] = useState<"details" | "payment">("details");
  const [clientSecret, setClientSecret] = useState("");
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Shipping form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");

  const inputClass = "w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400";

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setLoading(true);
    setError("");
    try {
      const order = await api.createOrder({
        customer_name: name,
        customer_email: email,
        shipping_address: { line1, city, state, postal_code: zip, country: "US" },
        items: [config],
      });
      setOrderId(order.id);
      setClientSecret(order.stripe_client_secret!);
      setStep("payment");
    } catch (err: any) {
      setError(err.message || "Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  if (!config) {
    return <main className="max-w-lg mx-auto px-4 py-10"><p className="text-red-600">Missing order config. Please go back.</p></main>;
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-8">Checkout</h1>

      {step === "details" && (
        <form onSubmit={handleContinue} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Full Name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Email</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Street Address</label>
            <input required value={line1} onChange={(e) => setLine1(e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">City</label>
              <input required value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">State</label>
              <input required value={state} onChange={(e) => setState(e.target.value)} className={inputClass} placeholder="NY" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">ZIP</label>
              <input required value={zip} onChange={(e) => setZip(e.target.value)} className={inputClass} />
            </div>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors">
            {loading ? "Preparing payment..." : "Continue to Payment →"}
          </button>
        </form>
      )}

      {step === "payment" && clientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <PaymentStep orderId={orderId} clientSecret={clientSecret} />
        </Elements>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Write `frontend/app/order-confirmation/page.tsx`**

```tsx
"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function OrderConfirmationPage() {
  const params = useSearchParams();
  const orderId = params.get("order_id");

  return (
    <main className="max-w-lg mx-auto px-4 py-20 text-center">
      <div className="text-5xl mb-6">🎉</div>
      <h1 className="text-2xl font-bold mb-3">Order Confirmed!</h1>
      <p className="text-gray-600 mb-2">Your order has been placed and sent to production.</p>
      {orderId && (
        <p className="text-sm text-gray-400 mb-8">Order ID: {orderId.slice(0, 8).toUpperCase()}</p>
      )}
      <p className="text-gray-600 mb-8">We'll email you when it ships.</p>
      <Link href="/" className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors">
        Order Another
      </Link>
    </main>
  );
}
```

- [ ] **Step 4: Add Stripe publishable key to frontend env**

Create `frontend/.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

- [ ] **Step 5: Manual end-to-end test**

```bash
# Start all services
docker compose up -d

# Forward Stripe webhooks locally
stripe listen --forward-to localhost:8000/webhooks/stripe
```

- Go to http://localhost:3000
- Select a product → configure → upload a logo → pick size → Proceed to Checkout
- Use Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC
- Confirm payment → verify redirect to `/order-confirmation`
- Check Stripe dashboard: payment captured
- Check FastAPI logs: Printful order submitted

- [ ] **Step 6: Commit**

```bash
git add frontend/components/CheckoutForm.tsx frontend/app/checkout/ frontend/app/order-confirmation/ frontend/.env.local
git commit -m "feat: checkout flow with Stripe Elements and order confirmation"
```

---

## Task 13: Final Wiring + Production Docker Compose

**Files:**
- Modify: `docker-compose.yml` (add production build mode)
- Modify: `frontend/next.config.js`
- Create: `.gitignore`

- [ ] **Step 1: Update `frontend/next.config.js` for standalone output**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "embi-print.s3.amazonaws.com" },
    ],
  },
};

module.exports = nextConfig;
```

- [ ] **Step 2: Write `.gitignore`**

```gitignore
# Python
__pycache__/
*.pyc
.env

# Node
node_modules/
.next/
frontend/.env.local

# Docker
pgdata/

# Superpowers
.superpowers/
```

- [ ] **Step 3: Add `.superpowers/` to gitignore and verify clean state**

```bash
git status
# Should show only tracked changes
```

- [ ] **Step 4: Full smoke test**

```bash
docker compose down -v
docker compose up --build -d
sleep 10
docker compose run --rm fastapi python seed.py
curl http://localhost:8000/health
curl http://localhost:8000/products/ | python3 -m json.tool
```

Expected: health returns `{"status":"ok"}`, products returns a list with 1 item and 4 zones.

- [ ] **Step 5: Run all backend tests**

```bash
docker compose run --rm fastapi bash -c "pytest tests/ -v"
```

Expected: all tests PASSED

- [ ] **Step 6: Final commit**

```bash
git add .gitignore docker-compose.yml frontend/next.config.js
git commit -m "feat: production Docker Compose wiring and final config"
```

---

## Summary

| Task | Deliverable |
|---|---|
| 1 | Docker Compose + FastAPI scaffold |
| 2 | DB models + Alembic migrations |
| 3 | Products API + seed data |
| 4 | Upload API + S3 storage |
| 5 | Celery DST conversion worker |
| 6 | Orders API + Stripe PaymentIntent |
| 7 | Stripe + Printful webhooks |
| 8 | Next.js setup + typed API client |
| 9 | Product listing homepage |
| 10 | MockupCanvas (live logo preview) |
| 11 | Customizer page (full flow) |
| 12 | Checkout + order confirmation |
| 13 | Production wiring |

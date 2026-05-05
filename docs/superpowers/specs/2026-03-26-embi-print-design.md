# embi_print — Custom Embroidery Web Service Design

**Date:** 2026-03-26
**Status:** Approved (with 2026-05-05 amendments — see bottom)

---

## Overview

A print-on-demand web service where customers upload a logo, configure its placement on a garment, preview the result, and check out. Fulfillment is handled automatically via the Printful API — no embroidery machine or inventory required.

---

## Scope (v1)

- **Garments:** T-shirts only (white and black)
- **Placement zones:** Left Chest, Center Chest, Right Chest, Full Back
- **Auth:** Guest checkout only (no accounts)
- **Fulfillment:** Printful API (automated)
- **Future (v2+):** Hoodies, jackets, hats; customer accounts; order tracking page; admin dashboard

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (React) |
| Backend API | FastAPI (Python) |
| Async workers | Celery + Redis |
| Database | PostgreSQL |
| File storage | S3 (or Cloudflare R2) |
| Payments | Stripe |
| Fulfillment | Printful API |
| Deployment | Docker Compose → Railway or DigitalOcean |

---

## System Architecture

```
Customer (Browser)
       │ HTTPS
Next.js Frontend
  - Product catalog
  - Canvas placement preview
  - Checkout (Stripe Elements)
       │ REST API
FastAPI Backend
  - Image upload endpoint
  - Order management
  - Stripe webhook handler
  - Printful API client
  ├── enqueue job → Celery Worker (DST conversion, stitch count)
  ├── read/write  → PostgreSQL
  ├── files       → S3
  └── API calls   → Printful API
       │
     Redis (Celery broker)
```

**External services (no self-hosting):** S3, Stripe, Printful API

---

## Customer Flow

```
1. Land on product page → pick shirt
2. Pick color (white / black)
3. Pick placement zone (Left Chest / Center Chest / Right Chest / Full Back)
4. Upload logo (PNG, JPG, SVG, AI — max 10MB)
   → Background: FastAPI stores to S3, enqueues DST conversion job
   → Celery: runs convert.py pipeline → stores DST to S3, updates stitch count
5. Live mockup preview updates in browser (canvas overlay, no server call)
6. Pick size (S / M / L / XL / XXL)
7. See price breakdown (base + zone add-on)
8. Proceed to Checkout → fill name, email, shipping address
9. Pay via Stripe Elements
10. Order confirmed → Printful auto-fulfills → customer receives package
```

---

## Pricing Model

**Base price + zone add-on** (flat rates, not stitch-count based for v1):

- Base shirt price: set per product in DB
- Zone add-ons: set per `placement_zone` record (e.g. Left Chest +$8, Full Back +$18)
- Stitch count is displayed to the customer for transparency but does not affect price in v1

---

## Data Model

### `products`
```
id, name, type (shirt | jacket | hoodie | hat), base_price
colors: JSON [{ name, hex, mockup_images: { left_chest, center_chest, right_chest, full_back } }]
sizes: JSON [S, M, L, XL, XXL]
```

### `placement_zones`
```
id, product_id, name (left_chest | center_chest | right_chest | full_back)
add_on_price, max_width_mm, max_height_mm
position_on_mockup: JSON { x, y, w, h }   -- pixel coords for canvas overlay
```

### `uploads`
```
id, s3_key, original_filename, mime_type
dst_s3_key        -- nullable, populated after Celery job completes
stitch_count      -- nullable, populated after Celery job completes
created_at
```

### `orders`
```
id, status (pending | paid | submitted_to_printful | shipped | delivered)
customer_email, customer_name
shipping_address: JSON
stripe_payment_intent_id, printful_order_id
total_price, created_at
```

### `order_items`
```
id, order_id, product_id, zone_id, upload_id
size, color, quantity, unit_price
```

**Key design decisions:**
- `placement_zones.position_on_mockup` drives the canvas overlay without server calls
- `uploads` is decoupled from `orders` — DST conversion runs async, checkout proceeds when upload completes
- `products.type` is garment-agnostic — adding jackets/hats in v2 is config, not code changes

---

## Customizer UI

Two-panel layout on the product page:

**Left panel — Live Preview:**
- Garment mockup image (PNG per color)
- Logo overlaid using HTML Canvas at zone coordinates
- Updates instantly on color/zone change (no API call)
- Shows stitch count estimate once DST job completes

**Right panel — Configuration steps:**
1. Color picker (white / black swatches)
2. Zone selector (buttons with add-on price labels)
3. Logo upload (drag & drop, shows conversion status)
4. Size selector (S / M / L / XL / XXL)
5. Price breakdown (base + zone add-on = total)
6. "Proceed to Checkout" button (enabled once image is stored in S3 — DST conversion runs in background and stitch count appears when ready, but does not block checkout)

---

## Checkout & Fulfillment Flow

```
1. Customer submits name, email, shipping address
2. Frontend requests PaymentIntent from FastAPI
3. Stripe Elements collects and processes payment
4. Stripe webhook → FastAPI:
   a. Mark order as `paid`
   b. Call Printful API: create order with uploaded image + placement + shipping
   c. Store Printful order ID
   d. Send confirmation email (SendGrid or similar)
5. Printful prints + ships
6. Printful webhook → FastAPI:
   a. Mark order as `shipped`, store tracking number
```

**Note:** Printful performs their own embroidery conversion from the uploaded image. The `convert.py` DST pipeline is used for stitch count estimation and preview quality validation — the DST file is not submitted to Printful.

---

## DST Pipeline Role (existing `convert.py`)

| Use | Description |
|---|---|
| Stitch count estimate | Runs after upload, result shown in customizer UI |
| Quality validation | Catches low-res or poorly traced images early |
| Future: direct fulfillment | If switching away from Printful to a local shop, DST files are ready |

The pipeline runs as a **Celery worker** inside the existing Docker container. Results stored in S3 and referenced in the `uploads` table.

---

## Deployment

```
docker-compose.yml
  ├── nextjs     — port 3000
  ├── fastapi    — port 8000
  ├── celery     — same image as fastapi, different entrypoint
  ├── redis      — Celery broker
  └── postgres   — database

External (no Docker):
  S3 · Stripe · Printful API
```

**Production target:** Railway (simplest) or single DigitalOcean droplet ($10/mo) running Docker Compose.

---

## Out of Scope (v1)

- Customer accounts / order history
- Admin dashboard
- Order tracking page for customers
- Multiple garment types
- Multiple logo placements per order
- Bulk / corporate ordering

---

## 2026-05-05 Amendments

After a brainstorming review of the original 13-task implementation plan, the following structural changes were adopted. The full revised plan lives in [`docs/superpowers/plans/2026-05-05-embi-print-revised.md`](../plans/2026-05-05-embi-print-revised.md).

### A1. Drop Celery + Redis from v1

**Original:** DST conversion runs as a Celery task, with Redis as the broker.
**Revised:** DST conversion runs **synchronously inside `POST /uploads`** with a 10-second timeout. On timeout/failure, the upload is still accepted (`status=failed`, `stitch_count=NULL`); the customizer UI surfaces "stitch-count estimate unavailable" without blocking checkout.
**Why:** Printful performs its own embroidery conversion. `convert.py` only produces a cosmetic stitch-count estimate. Running an entire broker + worker container for that is infrastructure debt with no v1 user value. Re-introduce in v2 if direct fulfillment replaces Printful.

### A2. Mockup placement coordinates: pixel → percentage

**Original:** `placement_zones.position_on_mockup = { x, y, w, h }` in pixels.
**Revised:** `placement_zones.position_on_mockup = { x_pct, y_pct, w_pct, h_pct }` as floats in `[0, 1]`.
**Why:** Pixel coords are brittle to mockup re-rendering at any size other than the original. Percentages work at any canvas size on any device.

### A3. Add `product_variants` table

**Original:** `products.colors` and `products.sizes` are JSON columns on `products`.
**Revised:** New table:

```
product_variants
  id, product_id (FK), color, size,
  printful_variant_id (NOT NULL),
  price_delta (NUMERIC(10,2), default 0),
  UNIQUE(product_id, color, size)
```

`OrderItem` references `variant_id` instead of `(color, size)` strings.
**Why:** Printful fulfillment requires `(catalog_product_id, variant_id)` per (color, size). Without this mapping, Phase 2 cannot submit orders. Also enables FK integrity and per-variant pricing.

### A4. Mockup images: static PNGs

**Original:** Unspecified — `colors[].mockup_images.{zone}` URLs were stored but no source named.
**Revised:** Ship hand-curated PNGs at `frontend/public/mockups/{color}/{view}.png` (where `view` is `front` or `back`; the four chest zones share the front mockup, full back uses the back). Printful Mockup Generator API integration deferred to v2.
**Why:** v1 ships without an external API dependency for mockups. 4 files (white/black × front/back) is trivial.

### A5. Webhook idempotency

**Original:** Spec didn't enforce uniqueness on payment/order identifiers.
**Revised:**

- `orders.stripe_payment_intent_id` is `UNIQUE` (nullable-unique).
- `orders.printful_order_id` is `UNIQUE` (nullable-unique).
- Stripe webhook handler is idempotent: if the order is already past `pending`, return 200 without state change.

**Why:** Stripe webhooks are at-least-once. Without uniqueness + idempotent transitions, a retried webhook can double-submit to Printful or double-send the confirmation email.

### A6. Decouple Printful submission from Stripe webhook

**Original:** Stripe webhook calls Printful synchronously (Customer Flow step 4b).
**Revised:** Stripe webhook marks the order `paid`, then enqueues a **FastAPI BackgroundTask** that calls Printful with `idempotency_key=order.id`. If Printful is down, the webhook still returns 200 (Stripe won't retry); a separate retry job picks it up.
**Why:** A 5xx from the webhook causes Stripe to retry; if the prior call already submitted to Printful, you get duplicate orders. Decoupling + idempotency keys solves both.

### A7. Rate-limiting on uploads

**Original:** None.
**Revised:** `slowapi` limiter on `POST /uploads` at `10/minute` per IP.
**Why:** Open S3 write endpoint is a storage-abuse vector.

### A8. CI gate

**Original:** None mentioned.
**Revised:** GitHub Actions workflow blocking merge to `main`: backend (`pytest`, `ruff`, `mypy`, `alembic upgrade head`), frontend (`tsc --noEmit`, `next build`, `playwright test`).
**Why:** Last manual commit was literally `sjkfs` — quality slipped. Automated gate prevents that.

### A9. Customer Flow correction (step 4)

The original Customer Flow step 4 says "FastAPI stores to S3, enqueues DST conversion job → Celery: runs convert.py pipeline → stores DST to S3, updates stitch count". Under A1, this becomes:

> Upload logo (PNG, JPG, SVG — max 10MB)
> → FastAPI stores to S3, runs `convert.py` inline (10s timeout), stores DST to S3 + stitch count
> → On timeout/failure: upload is still accepted; UI shows "stitch-count estimate unavailable"

(MIME type `application/pdf` was in the original implementation but is removed — Printful does not accept PDF, and the convert pipeline doesn't handle it cleanly.)

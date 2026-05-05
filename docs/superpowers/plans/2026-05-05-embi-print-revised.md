# embi_print Implementation Plan — Revised

**Date:** 2026-05-05
**Supersedes:** `docs/superpowers/plans/2026-03-26-embi-print-implementation.md`
**Spec:** `docs/superpowers/specs/2026-03-26-embi-print-design.md` (with corrections in Phase 0 below)
**Status:** Proposed

---

## Why this revision exists

The original 13-task plan (2026-03-26) was approved and partially executed (Tasks 1–3 committed; Task 4 partially committed as `dd98d39 sjkfs`, a WIP). Before continuing, the plan was stress-tested and the following load-bearing problems were identified:

1. **Celery + Redis is overbuilt for v1.** Printful does its own embroidery conversion. `convert.py` only produces a *displayed stitch-count estimate* — a cosmetic number. Spinning up a broker and worker container for that is infrastructure debt with no v1 user value.
2. **No Printful variant-ID mapping in the data model.** `products.colors` and `products.sizes` are JSON blobs; Printful fulfillment requires `(catalog_product_id, variant_id)` per (product, color, size). When Task 7 calls Printful, the mapping doesn't exist.
3. **`placement_zones.position_on_mockup` is in pixel coords.** Brittle to mockup re-rendering at any other size. Should be percentages of mockup width/height.
4. **Mockup image source is unspecified.** The data model stores `mockup_images.{zone}` URLs but neither the spec nor the original plan says where these come from.
5. **Stripe webhook calls Printful synchronously.** If Printful is down, the webhook 5xxs, Stripe retries, customer gets duplicate orders.
6. **Webhook idempotency is not enforced.** `stripe_payment_intent_id` should be UNIQUE.
7. **`POST /uploads` has no rate limiting and no session binding.** Open S3 write vector; nothing prevents an attacker from enumerating upload IDs.
8. **No CI gate.** Last commit message is literally `sjkfs` — quality has slipped.
9. **Frontend test coverage thin.** Original plan focuses on pytest; nothing for the customizer flow.

This revision: drops Celery from v1, normalizes variants, switches mockup coords to percentages, decouples Printful from the Stripe webhook, adds rate-limiting, and adds CI.

---

## Tech stack changes vs. original plan

| Layer | Original (2026-03-26) | Revised (this plan) | Reason |
|---|---|---|---|
| Async workers | Celery + Redis | **FastAPI BackgroundTasks** (in-process) | One container fewer; v1 has no real async workload |
| Broker | Redis (separate service) | **Removed in v1** | Re-add in v2 if direct fulfillment replaces Printful |
| Mockup coords | Pixel | **Percentage of mockup w/h** | Robust to image resizing |
| Variants | `colors`/`sizes` JSON on product | **`product_variants` table** | Required for Printful fulfillment + price integrity |
| Mockup images | Unspecified | **Static PNGs in `frontend/public/mockups/`** | No external dependency for v1; Printful Mockup API in v2 |
| Webhook → Printful | Synchronous in handler | **BackgroundTask + idempotency on `printful_order_id`** | Stripe retries don't double-submit |
| Rate-limit | None | **slowapi** on `/uploads` | Storage abuse prevention |
| CI | None | **GitHub Actions** (pytest, ruff, tsc, Playwright smoke) | No more `sjkfs` commits |

Everything else (FastAPI, SQLAlchemy + Alembic, PostgreSQL, S3, Stripe Elements, Next.js 14, Tailwind, TypeScript, Docker Compose) stays as the original plan specified.

---

## Where we are now (status snapshot)

| Original task | What's on disk | Commit | Outcome under revised plan |
|---|---|---|---|
| 1. Scaffold + Compose | done | `1a1b98e` | Compose to be edited (drop redis/celery) |
| 2. Models + Alembic | done | `433c539` | Migration to be added (variants, indexes) |
| 3. Seed + Products API | done | `e756877` | Re-seed once variants land |
| 4. Upload + S3 | partial WIP | `dd98d39 sjkfs` | Salvage `routers/uploads.py`, `storage.py`; **delete `worker.py`**; inline DST conversion |
| 5–13 | not started | — | Replaced by Phases 2–8 below |

---

## File structure (post-revision)

```
embi_print/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py                    # +ProductVariant, indexes
│   ├── schemas.py
│   ├── storage.py
│   ├── dst.py                       # NEW: convert.py wrapped as a callable, returns stitch_count
│   ├── ratelimit.py                 # NEW: slowapi limiter
│   ├── routers/
│   │   ├── products.py              # exists
│   │   ├── uploads.py               # exists; switch to inline DST
│   │   ├── orders.py                # NEW
│   │   ├── payments.py              # NEW (PaymentIntent endpoint)
│   │   └── webhooks.py              # NEW
│   ├── services/
│   │   ├── printful.py              # NEW
│   │   ├── stripe_service.py        # NEW
│   │   └── email.py                 # NEW
│   ├── convert.py                   # existing pipeline (kept; called from dst.py)
│   ├── seed.py                      # exists; expand for variants
│   ├── alembic/
│   │   └── versions/
│   │       ├── 6258883002d9_initial_schema.py   # exists
│   │       └── <new>_variants_indexes.py        # NEW
│   └── tests/                                   # extend coverage
├── frontend/                                     # NEW (Phase 3)
│   ├── app/
│   │   ├── page.tsx
│   │   ├── products/[id]/page.tsx
│   │   ├── checkout/page.tsx
│   │   └── order-confirmation/[id]/page.tsx
│   ├── components/
│   │   ├── ProductCard.tsx
│   │   ├── VariantPicker.tsx
│   │   ├── ZonePicker.tsx
│   │   ├── LogoUploader.tsx
│   │   ├── MockupCanvas.tsx
│   │   ├── PriceBreakdown.tsx
│   │   └── CheckoutForm.tsx
│   ├── public/mockups/{white,black}/{front,back}.png
│   ├── lib/{api.ts,types.ts}
│   └── tests/playwright/checkout.spec.ts
├── .github/workflows/ci.yml         # NEW
├── docker-compose.yml               # drop redis, drop celery
└── docs/superpowers/...             # this plan
```

---

## Phase 0 — Plan corrections (no code yet)

Goal: persist the structural decisions so they're discoverable later.

- [ ] **Step 1: Patch the spec** — append a "2026-05-05 amendments" section to `docs/superpowers/specs/2026-03-26-embi-print-design.md`:
  - v1 drops Celery + Redis; DST conversion runs inline with a 10s timeout
  - `placement_zones.position_on_mockup` switches from `{x,y,w,h}` pixels to `{x_pct, y_pct, w_pct, h_pct}` (0–1 floats)
  - New `product_variants` table replaces `products.colors`/`products.sizes` JSON
  - Mockup images shipped as static PNGs in `frontend/public/mockups/{color}/{view}.png` for v1
  - `orders.stripe_payment_intent_id` is UNIQUE
  - Printful submission is decoupled from the Stripe webhook (BackgroundTask)

- [ ] **Step 2: Mark the original plan superseded** — add a one-line banner at the top of `2026-03-26-embi-print-implementation.md`: `> SUPERSEDED by 2026-05-05-embi-print-revised.md`

- [ ] **Step 3: Commit Phase 0**

```powershell
git add docs/superpowers/
git commit -m "docs: revise embi_print plan; spec amendments for v1 simplifications"
```

---

## Phase 1 — Backend hygiene + variants

Salvage Task 4, kill Celery, normalize the data model.

- [ ] **Step 1: Delete `backend/worker.py`** and remove the Celery import + `run_dst_conversion.delay(...)` call from `routers/uploads.py`.

- [ ] **Step 2: Drop `redis` and `celery` services from `docker-compose.yml`**, remove their build context references.

- [ ] **Step 3: Remove `celery==5.4.0` and `redis==5.0.4` from `backend/requirements.txt`**. Add `slowapi==0.1.9`.

- [ ] **Step 4: Create `backend/dst.py`** — synchronous wrapper around `convert.py`:

  ```python
  # Signature
  def convert_to_dst(image_bytes: bytes, mime_type: str) -> tuple[bytes, int]:
      """Returns (dst_bytes, stitch_count). Raises DSTConversionError on failure."""
  ```

  Internals call the existing pipeline (potrace → SVG → pyembroidery), capture stitch count from the resulting `EmbPattern`. Wrap in `concurrent.futures.ThreadPoolExecutor` with a 10s timeout when called from the request path.

- [ ] **Step 5: Update `routers/uploads.py`** to call `dst.convert_to_dst` inline; on success store `dst_s3_key` + `stitch_count` and set `status=done`; on timeout/failure set `status=failed`, leave `stitch_count=NULL`, return 201 anyway (upload itself succeeded — DST is best-effort).

- [ ] **Step 6: Add `backend/ratelimit.py`** with slowapi limiter; apply `@limiter.limit("10/minute")` to `POST /uploads`.

- [ ] **Step 7: Migration `<new>_variants_indexes.py`** — `alembic revision -m "variants and indexes"`:
  - New table `product_variants`: `(id PK, product_id FK, color TEXT, size TEXT, printful_variant_id TEXT NOT NULL, price_delta NUMERIC(10,2) DEFAULT 0, UNIQUE(product_id, color, size))`
  - Add UNIQUE index on `orders.stripe_payment_intent_id`
  - Add UNIQUE index on `orders.printful_order_id` (nullable-unique)
  - Add index on `uploads.created_at`
  - Convert `placement_zones.position_on_mockup` JSON shape (data migration: divide pixel coords by mockup w/h to produce percentages — only safe because seed is the only data source so far; can `op.execute("DELETE FROM placement_zones")` then re-seed in Phase 1 Step 9)

- [ ] **Step 8: Update `models.py`** — add `ProductVariant`, drop `colors`/`sizes` JSON columns from `Product` after migration runs.

- [ ] **Step 9: Update `seed.py`** — write `product_variants` rows for each (white, black) × (S, M, L, XL, XXL) with placeholder Printful variant IDs; switch zone coords to percentages.

- [ ] **Step 10: Tests** — `tests/test_uploads.py` covering:
  - happy path (PNG → 201, status=done, stitch_count > 0)
  - oversized file (10MB+1 → 400)
  - unsupported MIME (→ 400)
  - DST timeout (mock `dst.convert_to_dst` to raise; assert 201 with `status=failed`)
  - rate-limit (11 calls in a minute → 429 on the 11th)

- [ ] **Step 11: Commit**

```powershell
git add backend/ docker-compose.yml
git commit -m "refactor(backend): drop celery/redis, inline DST, add variants + rate limit"
```

---

## Phase 2 — Orders, payments, webhooks

Replaces original Tasks 6 and 7; merges them because they share idempotency reasoning.

- [ ] **Step 1: `routers/orders.py`** — `POST /orders` accepts items referencing `(variant_id, zone_id, upload_id, quantity)`; computes `total_price = base_price + variant.price_delta + zone.add_on_price` server-side (never trust client); creates `Order(status=pending)` + `OrderItem`s in a single transaction.

- [ ] **Step 2: `routers/payments.py`** — `POST /orders/{id}/payment-intent` calls `stripe.PaymentIntent.create(amount=order.total_price * 100, currency="usd", metadata={"order_id": id})`; stores `stripe_payment_intent_id` on the order; returns `client_secret`.

- [ ] **Step 3: `services/printful.py`** — typed client with `submit_order(order)` and `get_order_status(printful_id)`; exponential backoff (3 retries); accepts an `idempotency_key` (use `order.id`).

- [ ] **Step 4: `services/stripe_service.py`** — webhook signature verification helper using `STRIPE_WEBHOOK_SECRET`.

- [ ] **Step 5: `routers/webhooks.py`**:
  - `POST /webhooks/stripe`: verify signature; on `payment_intent.succeeded`, look up order by `payment_intent_id`; **if `order.status != pending`, return 200 immediately (idempotent)**; transition to `paid`; enqueue `BackgroundTasks.add_task(submit_to_printful, order.id)`.
  - `POST /webhooks/printful`: on shipment event, set `status=shipped` + `tracking_number`.

- [ ] **Step 6: `submit_to_printful(order_id)` background task** — re-loads order; if `printful_order_id` already set, return; else call Printful with `idempotency_key=order.id`, store ID, transition status to `submitted_to_printful`.

- [ ] **Step 7: `services/email.py`** — SendGrid client, single `send_order_confirmation(order)` function. Called from the same BackgroundTask after Printful succeeds.

- [ ] **Step 8: Tests**:
  - `test_orders.py`: server-side total computation can't be overridden by client; cross-product price math
  - `test_webhooks.py`: bad signature → 400; same Stripe event delivered twice → no duplicate state changes; Printful failure → order stays `paid` (will be retried), no email sent
  - `test_printful.py`: idempotency key threaded through; retries on 5xx

- [ ] **Step 9: Commit**

```powershell
git commit -m "feat(backend): orders, payments, idempotent webhooks"
```

---

## Phase 3 — Frontend scaffolding

- [ ] **Step 1:** `npx create-next-app@14 frontend --ts --tailwind --app --eslint --src-dir=false --import-alias='@/*'`
- [ ] **Step 2:** Add to `frontend/`: `lib/api.ts` (typed fetch wrapper, reads `NEXT_PUBLIC_API_URL`), `lib/types.ts` (mirrors `schemas.py`).
- [ ] **Step 3:** Add Stripe.js + Stripe Elements (`@stripe/stripe-js`, `@stripe/react-stripe-js`).
- [ ] **Step 4:** Add Playwright (`npm i -D @playwright/test && npx playwright install --with-deps`).
- [ ] **Step 5:** Add `frontend` service to `docker-compose.yml`.
- [ ] **Step 6:** Commit.

---

## Phase 4 — Customizer (was Tasks 9–11)

- [ ] **Step 1: Product list `/`** — fetch `/products`, render `ProductCard`s.

- [ ] **Step 2: `MockupCanvas.tsx`** — takes `{ mockupSrc, logoSrc, position: { x_pct, y_pct, w_pct, h_pct } }`. On mount/resize, draws shirt then logo at `position.x_pct * canvas.width`, etc. **No API calls on parameter change** — pure client computation.

- [ ] **Step 3: `LogoUploader.tsx`** — drag/drop, `POST /uploads`, polls `GET /uploads/{id}` every 1s until `status` is `done` or `failed`. If `failed`, show "Stitch count unavailable, but your design will still print." (non-blocking).

- [ ] **Step 4: `VariantPicker.tsx` + `ZonePicker.tsx`** — color/size/zone selection drives price recalc client-side.

- [ ] **Step 5: `/products/[id]/page.tsx`** — composes the above; "Proceed to Checkout" enabled once `upload_id` exists (status of DST conversion does NOT block — design decision per spec).

- [ ] **Step 6: Component tests** with React Testing Library: price recalculation, zone selection visible on canvas.

- [ ] **Step 7: Commit.**

---

## Phase 5 — Checkout

- [ ] **Step 1: `/checkout/page.tsx`** — name, email, shipping address; on submit, `POST /orders` then `POST /orders/{id}/payment-intent`, mount Stripe Elements with returned `client_secret`.

- [ ] **Step 2: `/order-confirmation/[id]/page.tsx`** — polls `GET /orders/{id}` every 2s for status changes; renders timeline (`paid` → `submitted_to_printful` → `shipped`).

- [ ] **Step 3: Playwright E2E** — `tests/playwright/checkout.spec.ts`: full flow with Stripe test card `4242 4242 4242 4242`; assert order reaches `submitted_to_printful` (mock Printful via msw or by pointing `PRINTFUL_API_BASE` at a stub server).

- [ ] **Step 4: Commit.**

---

## Phase 6 — Email + status updates

- [ ] **Step 1:** Wire `email.send_order_confirmation` into the BackgroundTask after Printful submission succeeds.
- [ ] **Step 2:** Verify Printful webhook → status transitions show up on the confirmation page.
- [ ] **Step 3:** Commit.

---

## Phase 7 — CI + deployment

- [ ] **Step 1: `.github/workflows/ci.yml`**:
  - `backend`: postgres service, run `alembic upgrade head`, `pytest`, `ruff check`, `mypy backend`
  - `frontend`: `tsc --noEmit`, `next build`, `playwright test --reporter=github`
  - Block merge to `main` on failure (set required status checks in repo settings — manual one-time step)

- [ ] **Step 2: Production `docker-compose.prod.yml`** — no source volume mounts, no `--reload`, env from environment not `.env`.

- [ ] **Step 3: Railway (recommended) or DigitalOcean droplet** — point at `docker-compose.prod.yml`; set secrets in dashboard. **Do not commit `.env`.**

- [ ] **Step 4: S3 bucket policy** — server-only writes (no public PUT); reads via presigned URLs only.

- [ ] **Step 5: Commit.**

---

## Phase 8 — Pre-launch checklist

Manual verification, no code:

- [ ] Stripe test mode: success card, declined card (`4000000000000002`), 3DS card (`4000002500003155`)
- [ ] Stripe webhook signature verification: Stripe CLI `stripe trigger payment_intent.succeeded`
- [ ] Stripe replay protection: `stripe events resend evt_xxx` twice → no duplicate state changes
- [ ] Printful sandbox: real submission → real (sandbox) tracking number flows back via webhook
- [ ] S3: confirm uploaded objects are not public (curl the direct URL → 403)
- [ ] Rate limit: 11 rapid uploads → 429 on the 11th
- [ ] Confirmation email lands in inbox (not spam) for at least gmail + outlook
- [ ] Mobile Safari + Chrome: customizer canvas renders correctly, Stripe Elements works

---

## Estimated effort (rough)

| Phase | Effort |
|---|---|
| 0. Plan corrections | 1 hour |
| 1. Backend hygiene + variants | ~6 hours |
| 2. Orders / payments / webhooks | ~10 hours |
| 3. Frontend scaffold | 1 hour |
| 4. Customizer | ~10 hours |
| 5. Checkout | ~6 hours |
| 6. Email + status | ~2 hours |
| 7. CI + deploy | ~4 hours |
| 8. Pre-launch checklist | ~2 hours |
| **Total** | **~42 hours** |

(Original 13-task plan was implicitly larger because of the Celery surface area and frontend testing gap.)

---

## Out of scope (still v2+)

Same as original spec, plus explicitly:

- Celery + Redis re-introduction (only if direct fulfillment replaces Printful)
- Printful Mockup Generator API (use static PNGs in v1)
- Customer accounts, order tracking page, admin dashboard, multiple garments, multiple logos per order, bulk ordering

---

## Open questions before starting Phase 0

1. **Mockup PNGs:** does the user have actual product photography, or should v1 ship with publicly-licensed placeholder mockups (e.g., from Mockup World) until real photography exists?
2. **Printful account:** do we have a sandbox API key already, or does Phase 0 also include Printful account setup?
3. **SendGrid vs Resend:** SendGrid is in the original spec, but Resend has a much simpler API and is cheaper at low volume. Worth a swap?
4. **Domain + SSL:** Railway gives you a `*.up.railway.app` URL free; do you have a custom domain to wire up at deploy time?

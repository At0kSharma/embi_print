# Deployment

This is a single-host deployment guide. The recommended target is
**Railway** (managed Postgres, env via dashboard, $5/mo to start);
the same compose works on a $10 DigitalOcean droplet. **Do not commit
`.env` files.**

---

## Prerequisites

Before deploying, you must have:

1. **Postgres database** (Railway add-on, RDS, or self-hosted)
2. **S3 bucket** with server-only write policy (see [§ S3 policy](#s3-bucket-policy) below)
3. **Stripe account**
   - publishable key (`pk_live_...`)
   - secret key (`sk_live_...`)
   - a webhook endpoint registered → `https://<your-domain>/webhooks/stripe`, copy the signing secret (`whsec_...`)
4. **Printful account**
   - API key from the Printful dashboard
   - Real catalog variant IDs — replace the `PF_WHITE_S` placeholders in `backend/seed.py` before seeding
   - a webhook endpoint registered → `https://<your-domain>/webhooks/printful`
5. **SendGrid account** (or swap to Resend in `backend/services/email.py`) with verified sender domain

---

## Required environment variables

Set these in Railway's dashboard (or `--env` when deploying elsewhere). **Never put real values in `.env` files committed to git.**

```
# Backend
DATABASE_URL=postgresql://user:pass@host:5432/dbname
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=embi-print-prod
AWS_REGION=us-east-1
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
PRINTFUL_API_KEY=...
SENDGRID_API_KEY=SG....
EMAIL_FROM=orders@your-domain.com
FRONTEND_URL=https://your-domain.com

# Frontend (NEXT_PUBLIC_* are baked into the JS bundle at build time)
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

For the production compose file (`docker-compose.prod.yml`) running on a
single host, set these via the host's environment and pass them through:

```
export $(grep -v '^#' .env.prod | xargs)   # if you must use a file, keep .env.prod off git
docker compose -f docker-compose.prod.yml up -d --build
```

---

## First deploy (single-host with Postgres in compose)

```bash
ssh root@your-host
git clone https://github.com/<you>/embi_print
cd embi_print
# Set all required env vars in the shell first (do NOT commit a .env file)
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec fastapi alembic upgrade head
docker compose -f docker-compose.prod.yml exec fastapi python3 seed.py
```

A reverse proxy (Caddy / Traefik / nginx) terminates TLS and routes:

- `your-domain.com` → `nextjs:3000`
- `api.your-domain.com` → `fastapi:8000`

Or, on Railway, two services (one per Dockerfile) with their own public URLs.

---

## S3 bucket policy

Server-only writes (no public PUT). Reads via presigned URLs only — Printful
uses these to fetch the design asset.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyPublicWrite",
      "Effect": "Deny",
      "Principal": "*",
      "Action": ["s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::embi-print-prod/*",
      "Condition": {
        "StringNotEquals": { "aws:PrincipalArn": "arn:aws:iam::<account-id>:user/embi-print-backend" }
      }
    }
  ]
}
```

Bucket-level public access: **fully blocked**. The `embi-print-backend` IAM
user gets a policy granting `s3:PutObject` and `s3:GetObject` on the bucket.

---

## Webhook setup

After the app is reachable on its public URLs:

**Stripe:**

```
Stripe Dashboard → Developers → Webhooks → Add endpoint
  URL: https://api.your-domain.com/webhooks/stripe
  Events: payment_intent.succeeded
  Copy signing secret → STRIPE_WEBHOOK_SECRET
```

**Printful:**

```
Printful Dashboard → Settings → API → Webhooks
  URL: https://api.your-domain.com/webhooks/printful
  Events: package_shipped
```

Test both with `stripe events resend evt_xxx` and the Printful sandbox.

---

## Rollback

The migration in Phase 1 (drops `products.colors`/`sizes` JSON) is destructive.
If you must roll back the app to a pre-Phase-1 commit:

```
docker compose exec fastapi alembic downgrade -1
git checkout <pre-phase-1-commit>
docker compose -f docker-compose.prod.yml up -d --build
```

Re-seed afterwards (`python seed.py`).

---

## What's still manual (v1)

- Replace `PF_*` placeholder Printful variant IDs in `backend/seed.py` with real catalog IDs
- Replace `frontend/public/mockups/*.png` placeholders with real product photography
- Wire a status-monitoring dashboard (Sentry, Better Stack, or just `docker logs`)
- Decide between SendGrid and Resend (currently SendGrid; Resend has a much simpler API)

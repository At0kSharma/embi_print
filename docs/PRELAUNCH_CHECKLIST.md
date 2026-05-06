# Pre-launch checklist

Phase 8 of the 2026-05-05 revised plan. These are manual verification
steps to run **after deployment** but **before announcing launch**. None
of this can be CI-automated without giving CI live API keys.

Track completion by checking the boxes below.

---

## Stripe — payments

Use Stripe **test mode** keys until the very last step.

- [ ] **Successful payment.** Card `4242 4242 4242 4242`, any future
      expiry, any 3-digit CVC. Order should reach status
      `submitted_to_printful` within ~10s and the confirmation email
      should land.

- [ ] **Declined card.** Card `4000 0000 0000 0002`. Confirm the user
      sees a clear failure message and the order stays at status
      `pending`.

- [ ] **3D Secure card.** Card `4000 0025 0000 3155`. Confirm the 3DS
      challenge renders correctly on mobile + desktop and the post-3DS
      redirect lands on `/order-confirmation/{id}`.

- [ ] **Webhook signature verification.** From the Stripe CLI:
      ```
      stripe listen --forward-to https://api.your-domain.com/webhooks/stripe
      stripe trigger payment_intent.succeeded
      ```
      Backend should return 200. Tampering with the signing secret
      should produce 400.

- [ ] **Replay protection.** With the same event:
      ```
      stripe events resend evt_xxx
      stripe events resend evt_xxx     # second time
      ```
      Backend logs should show `already_processed=true` on the second
      delivery; only **one** Printful order should be created and only
      **one** confirmation email sent.

---

## Printful — fulfillment

Use the Printful **sandbox** environment until the last step.

- [ ] **Real catalog variant IDs in seed.py.** Replace the
      `PF_WHITE_S` / `PF_BLACK_M` placeholders with real catalog IDs
      from `https://www.printful.com/api/products`. Re-seed the prod DB.

- [ ] **Sandbox submission.** Run an end-to-end purchase using a Stripe
      test card — order should appear in the Printful sandbox
      dashboard within ~10s of webhook delivery.

- [ ] **Asset URL is reachable.** The image URL in the Printful payload
      is a presigned S3 URL — open it in an incognito browser and
      confirm the upload renders. Printful fetches it themselves; if
      this URL 403s, fulfillment will silently fail.

- [ ] **Shipped webhook flips status.** Trigger a `package_shipped`
      event in the Printful sandbox dashboard. Confirm:
      - order.status becomes `shipped`
      - tracking_number is populated
      - shipped-notification email lands

---

## Storage — S3

- [ ] **Bucket is private.** `curl -I https://embi-print-prod.s3.amazonaws.com/uploads/<some-key>.png`
      should return **403** without auth. Public listing should be
      blocked.

- [ ] **Server can write.** Upload a logo through the customizer and
      confirm a new `uploads/<uuid>.png` and `dst/<id>.dst` appear in
      the bucket.

- [ ] **Presigned URLs expire.** A presigned URL produced for the
      Printful payload should 403 after its expiration window.

---

## Rate limit

- [ ] **/uploads is rate-limited.** From a single IP:
      ```bash
      ./scripts/verify_rate_limit.sh https://api.your-domain.com
      ```
      The 11th request in a minute should return **429**.

---

## Email

- [ ] **From-domain is verified.** SendGrid (or Resend) sender domain
      shows DKIM/SPF green in the dashboard.

- [ ] **Lands in inbox, not spam.** Send a test confirmation to
      gmail.com, outlook.com, and one custom domain. Verify all three
      land in inbox.

- [ ] **Subject line is informative.** No `[Sandbox]` or `[Test]`
      leaking through to production messages.

---

## Frontend — devices + browsers

- [ ] **Desktop Chrome:** Customizer canvas renders, color/size
      switching works, upload progress visible, checkout completes.

- [ ] **Desktop Safari:** Same.

- [ ] **iOS Safari (real device, not simulator):** Drag-and-drop falls
      back to click-to-upload; canvas scales correctly; Stripe Elements
      Apple Pay button (if enabled) renders.

- [ ] **Android Chrome:** Same.

---

## Final cutover (live keys)

Only after all of the above pass:

- [ ] Replace all Stripe test keys with live keys in Railway env.
- [ ] Replace all Printful sandbox keys with live keys.
- [ ] Re-register Stripe webhook with live signing secret.
- [ ] Re-register Printful webhook against live store.
- [ ] Run one **real, no-discount** purchase from a personal card.
      Cancel/refund afterwards via the Stripe dashboard. Confirm the
      Printful order is also cancelled.
- [ ] Take a backup of the Postgres DB before announcing.

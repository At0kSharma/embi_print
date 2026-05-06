"use client";

import { Elements } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { api, ApiError } from "@/lib/api";
import type { Order, ShippingAddress } from "@/lib/types";
import { CheckoutForm } from "./CheckoutForm";

let _stripe: Promise<Stripe | null> | null = null;
function getStripe(): Promise<Stripe | null> {
  if (_stripe) return _stripe;
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return Promise.resolve(null);
  _stripe = loadStripe(key);
  return _stripe;
}

export function CheckoutPanel() {
  const params = useSearchParams();
  const router = useRouter();

  const variantId = params.get("variant_id");
  const zoneId = params.get("zone_id");
  const uploadId = params.get("upload_id");
  const quantity = Math.max(1, parseInt(params.get("quantity") ?? "1", 10) || 1);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState<ShippingAddress>({
    line1: "",
    line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "US",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const stripePromise = useMemo(() => getStripe(), []);
  const stripeKeyMissing = !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  if (!variantId || !zoneId || !uploadId) {
    return (
      <p className="mt-6 text-sm text-red-600">
        Missing checkout details. Start from the product page.
      </p>
    );
  }

  const handleStartPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.createOrder({
        customer_name: name,
        customer_email: email,
        shipping_address: address,
        items: [
          {
            variant_id: variantId,
            zone_id: zoneId,
            upload_id: uploadId,
            quantity,
          },
        ],
      });
      setOrder(created);

      const intent = await api.createPaymentIntent(created.id);
      setClientSecret(intent.client_secret);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (order && clientSecret && !stripeKeyMissing) {
    return (
      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <CheckoutForm
          order={order}
          onPaid={() => router.push(`/order-confirmation/${order.id}`)}
        />
      </Elements>
    );
  }

  if (order && stripeKeyMissing) {
    return (
      <div className="mt-6 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Order created (id: <code>{order.id}</code>), but the Stripe publishable
        key is not configured. Set <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>
        and reload to pay.
      </div>
    );
  }

  return (
    <form onSubmit={handleStartPayment} className="mt-6 space-y-5">
      <Field
        label="Full name"
        value={name}
        onChange={setName}
        required
        autoComplete="name"
      />
      <Field
        label="Email"
        value={email}
        onChange={setEmail}
        required
        type="email"
        autoComplete="email"
      />
      <Field
        label="Address line 1"
        value={address.line1}
        onChange={(v) => setAddress({ ...address, line1: v })}
        required
        autoComplete="address-line1"
      />
      <Field
        label="Address line 2 (optional)"
        value={address.line2 ?? ""}
        onChange={(v) => setAddress({ ...address, line2: v })}
        autoComplete="address-line2"
      />
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="City"
          value={address.city}
          onChange={(v) => setAddress({ ...address, city: v })}
          required
          autoComplete="address-level2"
        />
        <Field
          label="State / region"
          value={address.state}
          onChange={(v) => setAddress({ ...address, state: v })}
          required
          autoComplete="address-level1"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Postal code"
          value={address.postal_code}
          onChange={(v) => setAddress({ ...address, postal_code: v })}
          required
          autoComplete="postal-code"
        />
        <Field
          label="Country (ISO code)"
          value={address.country}
          onChange={(v) => setAddress({ ...address, country: v.toUpperCase() })}
          required
          maxLength={2}
          autoComplete="country"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition disabled:bg-neutral-300"
      >
        {submitting ? "Creating order…" : "Continue to payment"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  autoComplete,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        maxLength={maxLength}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
      />
    </label>
  );
}

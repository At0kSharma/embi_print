"use client";

import { Elements } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  const [order, setOrder] = useState<Order | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const stripePromise = useMemo(() => getStripe(), []);
  const stripeKeyMissing = !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  if (!variantId || !zoneId || !uploadId) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Missing checkout details.</p>
            <p className="mt-0.5">
              Start from a{" "}
              <a href="/" className="underline">
                product page
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleStartPayment = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const detail = e instanceof ApiError ? e.detail : String(e);
      toast.error("Couldn't create your order", { description: detail });
    } finally {
      setSubmitting(false);
    }
  };

  if (order && clientSecret && !stripeKeyMissing) {
    return (
      <div className="space-y-6">
        <OrderRecap order={order} />
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CheckoutForm
            order={order}
            onPaid={() => router.push(`/order-confirmation/${order.id}`)}
          />
        </Elements>
      </div>
    );
  }

  if (order && stripeKeyMissing) {
    return (
      <div className="space-y-6">
        <OrderRecap order={order} />
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Order created, but Stripe is not configured.</p>
          <p className="mt-1">
            Order id: <code className="rounded bg-amber-100 px-1 text-xs">{order.id}</code>
          </p>
          <p className="mt-2">
            Set <code className="rounded bg-amber-100 px-1 text-xs">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> and reload to pay.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleStartPayment} className="space-y-6">
      <Section title="Contact">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id="name"
            label="Full name"
            value={name}
            onChange={setName}
            required
            autoComplete="name"
          />
          <Field
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            required
            autoComplete="email"
          />
        </div>
      </Section>

      <Separator />

      <Section title="Shipping address">
        <div className="grid grid-cols-1 gap-4">
          <Field
            id="line1"
            label="Address line 1"
            value={address.line1}
            onChange={(v) => setAddress({ ...address, line1: v })}
            required
            autoComplete="address-line1"
          />
          <Field
            id="line2"
            label="Address line 2"
            value={address.line2 ?? ""}
            onChange={(v) => setAddress({ ...address, line2: v })}
            autoComplete="address-line2"
            optional
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="city"
              label="City"
              value={address.city}
              onChange={(v) => setAddress({ ...address, city: v })}
              required
              autoComplete="address-level2"
            />
            <Field
              id="state"
              label="State / region"
              value={address.state}
              onChange={(v) => setAddress({ ...address, state: v })}
              required
              autoComplete="address-level1"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="postal_code"
              label="Postal code"
              value={address.postal_code}
              onChange={(v) => setAddress({ ...address, postal_code: v })}
              required
              autoComplete="postal-code"
            />
            <Field
              id="country"
              label="Country (ISO code)"
              value={address.country}
              onChange={(v) =>
                setAddress({ ...address, country: v.toUpperCase() })
              }
              required
              maxLength={2}
              autoComplete="country"
            />
          </div>
        </div>
      </Section>

      <Button
        type="submit"
        size="lg"
        disabled={submitting}
        className="w-full"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating order…
          </>
        ) : (
          "Continue to payment"
        )}
      </Button>
    </form>
  );
}

function OrderRecap({ order }: { order: Order }) {
  return (
    <div className="rounded-md border bg-muted/30 p-4 text-sm">
      <div className="flex items-baseline justify-between">
        <span className="text-muted-foreground">Order</span>
        <code className="text-xs">{order.id.slice(0, 8)}</code>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-muted-foreground">Total</span>
        <span className="font-medium tabular-nums">
          ${order.total_price.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  optional?: boolean;
  type?: string;
  autoComplete?: string;
  maxLength?: number;
}

function Field({
  id,
  label,
  value,
  onChange,
  required,
  optional,
  type = "text",
  autoComplete,
  maxLength,
}: FieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        {optional && (
          <span className="text-xs text-muted-foreground">Optional</span>
        )}
      </div>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        maxLength={maxLength}
      />
    </div>
  );
}

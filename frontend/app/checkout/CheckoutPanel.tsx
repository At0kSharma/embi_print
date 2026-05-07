"use client";

import { Elements } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Loader2, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useCart } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api, ApiError } from "@/lib/api";
import { formatUSD } from "@/lib/pricing";
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
  const cart = useCart();
  const router = useRouter();

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

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

  // Wait for hydration before deciding the cart is empty — SSR sees [].
  if (!hydrated) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (cart.items.length === 0 && !order) {
    return <EmptyCart />;
  }

  const handleStartPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const created = await api.createOrder({
        customer_name: name,
        customer_email: email,
        shipping_address: address,
        items: cart.items.map((it) => ({
          variant_id: it.variant_id,
          zone_id: it.zone_id,
          upload_id: it.upload_id,
          quantity: it.quantity,
        })),
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

  const handlePaid = () => {
    if (!order) return;
    cart.clear();
    router.push(`/order-confirmation/${order.id}`);
  };

  if (order && clientSecret && !stripeKeyMissing) {
    return (
      <div className="space-y-6">
        <OrderRecap subtotal={order.total_price} itemCount={cart.items.length} />
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CheckoutForm order={order} onPaid={handlePaid} />
        </Elements>
      </div>
    );
  }

  if (order && stripeKeyMissing) {
    return (
      <div className="space-y-6">
        <OrderRecap subtotal={order.total_price} itemCount={cart.items.length} />
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
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <form onSubmit={handleStartPayment} className="space-y-6">
        <Section title="Contact">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="name" label="Full name" value={name} onChange={setName} required autoComplete="name" />
            <Field id="email" label="Email" type="email" value={email} onChange={setEmail} required autoComplete="email" />
          </div>
        </Section>

        <Separator />

        <Section title="Shipping address">
          <div className="grid grid-cols-1 gap-4">
            <Field id="line1" label="Address line 1" value={address.line1} onChange={(v) => setAddress({ ...address, line1: v })} required autoComplete="address-line1" />
            <Field id="line2" label="Address line 2" value={address.line2 ?? ""} onChange={(v) => setAddress({ ...address, line2: v })} autoComplete="address-line2" optional />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="city" label="City" value={address.city} onChange={(v) => setAddress({ ...address, city: v })} required autoComplete="address-level2" />
              <Field id="state" label="State / region" value={address.state} onChange={(v) => setAddress({ ...address, state: v })} required autoComplete="address-level1" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="postal_code" label="Postal code" value={address.postal_code} onChange={(v) => setAddress({ ...address, postal_code: v })} required autoComplete="postal-code" />
              <Field id="country" label="Country (ISO code)" value={address.country} onChange={(v) => setAddress({ ...address, country: v.toUpperCase() })} required maxLength={2} autoComplete="country" />
            </div>
          </div>
        </Section>

        <Button type="submit" size="lg" disabled={submitting} className="w-full">
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

      {/* Sticky cart summary */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <CartSummary />
      </aside>
    </div>
  );
}

function CartSummary() {
  const { items, subtotal } = useCart();
  return (
    <div className="rounded-md border bg-card p-5">
      <h3 className="mb-3 text-sm font-semibold">Your order</h3>
      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.id} className="flex justify-between gap-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{it.product_name}</div>
              <div className="text-xs text-muted-foreground">
                {it.color} · {it.size} · {it.zone_label}
                {it.quantity > 1 && ` · ×${it.quantity}`}
              </div>
            </div>
            <div className="shrink-0 tabular-nums">
              {formatUSD(it.unit_price * it.quantity)}
            </div>
          </li>
        ))}
      </ul>
      <Separator className="my-4" />
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">Subtotal</span>
        <span className="font-semibold tabular-nums">{formatUSD(subtotal)}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Tax and shipping calculated by the server when you submit.
      </p>
    </div>
  );
}

function OrderRecap({ subtotal, itemCount }: { subtotal: number; itemCount: number }) {
  return (
    <div className="rounded-md border bg-muted/30 p-4 text-sm">
      <div className="flex items-baseline justify-between">
        <span className="text-muted-foreground">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
        <span className="font-medium tabular-nums">{formatUSD(subtotal)}</span>
      </div>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-dashed bg-muted/30 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <ShoppingBag className="h-5 w-5 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold">Your cart is empty</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Pick a product, customize a logo, and add it to your cart before
        checking out.
      </p>
      <Button asChild>
        <a href="/">Browse products</a>
      </Button>
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

"use client";

import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useState } from "react";

import type { Order } from "@/lib/types";
import { formatUSD } from "@/lib/pricing";

interface Props {
  order: Order;
  onPaid: () => void;
}

export function CheckoutForm({ order, onPaid }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Card validation failed");
      setSubmitting(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      // The Stripe webhook drives the post-payment state machine. We just
      // need the client to land somewhere user-friendly after the redirect
      // round-trip (3DS, bank confirmation pages).
      confirmParams: {
        return_url: `${window.location.origin}/order-confirmation/${order.id}`,
      },
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed");
      setSubmitting(false);
      return;
    }
    // For non-redirect flows the promise resolves with no error and the
    // browser stays on this page; navigate explicitly.
    onPaid();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-5">
      <div className="rounded border border-neutral-200 bg-white p-4">
        <PaymentElement />
      </div>

      <p className="text-sm text-neutral-600">
        Total to charge:{" "}
        <strong className="text-neutral-900">
          {formatUSD(order.total_price)}
        </strong>
      </p>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full rounded bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition disabled:bg-neutral-300"
      >
        {submitting ? "Processing…" : `Pay ${formatUSD(order.total_price)}`}
      </button>
    </form>
  );
}

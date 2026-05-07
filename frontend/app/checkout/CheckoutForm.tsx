"use client";

import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Loader2, Lock, Package, ReceiptText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      toast.error("Payment validation failed", {
        description: submitError.message ?? "Please check your card details.",
      });
      setSubmitting(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/order-confirmation/${order.id}`,
      },
    });

    if (confirmError) {
      toast.error("Payment failed", {
        description: confirmError.message ?? "Please try again.",
      });
      setSubmitting(false);
      return;
    }
    onPaid();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-md border bg-card p-4">
        <PaymentElement
          options={{ layout: { type: "tabs", defaultCollapsed: false } }}
        />
      </div>

      {/* Trust strip */}
      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        <Trust icon={<Lock />} label="Secure payment" detail="Stripe-handled" />
        <Trust
          icon={<Package />}
          label="Made to order"
          detail="Ships in 5–7 days"
        />
        <Trust
          icon={<ReceiptText />}
          label="No hidden fees"
          detail="Tax & shipping in"
        />
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={!stripe || submitting}
        className="w-full"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing…
          </>
        ) : (
          <>Pay {formatUSD(order.total_price)}</>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Powered by Stripe. Cancel any time before fabric is cut.
      </p>
    </form>
  );
}

function Trust({
  icon,
  label,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border bg-card px-3 py-2.5">
      <div className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium leading-tight">{label}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
    </div>
  );
}

"use client";

import {
  Check,
  CreditCard,
  Loader2,
  Package,
  PackageCheck,
  PartyPopper,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { formatUSD } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/types";

const STAGES: { key: OrderStatus; label: string; icon: React.ElementType }[] = [
  { key: "pending", label: "Awaiting payment", icon: CreditCard },
  { key: "paid", label: "Payment confirmed", icon: Check },
  { key: "submitted_to_printful", label: "Sent to fulfillment", icon: Package },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: PackageCheck },
];

const POLL_INTERVAL_MS = 3000;
const TERMINAL: OrderStatus[] = ["shipped", "delivered"];

export function OrderStatusView({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await api.getOrder(orderId);
        if (cancelled) return;
        setOrder(next);
        setError(null);
        if (!TERMINAL.includes(next.status)) {
          setTimeout(tick, POLL_INTERVAL_MS);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.detail : String(e));
        setTimeout(tick, POLL_INTERVAL_MS * 2);
      }
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (error && !order) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Couldn&apos;t load order status: {error}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const currentIdx = STAGES.findIndex((s) => s.key === order.status);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <PartyPopper className="h-3.5 w-3.5" />
          Thanks for your order
        </div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          Your order is on its way to the workshop.
        </h1>
        <p className="text-pretty text-base text-muted-foreground">
          We&apos;ll email you when it ships. This page updates in real time —
          you can leave it open or come back later.
        </p>
      </div>

      {/* Order summary card */}
      <Card>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Order">
              <code className="text-xs">{order.id.slice(0, 8)}</code>
            </Stat>
            <Stat label="Total">
              <span className="font-medium tabular-nums">
                {formatUSD(order.total_price)}
              </span>
            </Stat>
            <Stat label="Status">
              <Badge variant="secondary" className="capitalize">
                {order.status.replace(/_/g, " ")}
              </Badge>
            </Stat>
          </div>

          {order.tracking_number && (
            <>
              <Separator className="my-4" />
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Tracking number</span>
                <code className="font-medium">{order.tracking_number}</code>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Progress</h2>
          <ol className="relative space-y-5 border-l border-border pl-6">
            {STAGES.map((stage, idx) => {
              const reached = idx <= currentIdx;
              const active = idx === currentIdx && !TERMINAL.includes(order.status);
              const Icon = stage.icon;
              return (
                <li
                  key={stage.key}
                  data-testid={`stage-${stage.key}`}
                  className="relative"
                >
                  <span
                    className={cn(
                      "absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background",
                      reached
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {active ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Icon className="h-3 w-3" />
                    )}
                  </span>
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      className={cn(
                        "text-sm",
                        reached ? "font-medium" : "text-muted-foreground",
                        active && "text-foreground",
                      )}
                    >
                      {stage.label}
                    </span>
                    {active && (
                      <span className="text-xs text-muted-foreground">In progress</span>
                    )}
                    {idx < currentIdx && (
                      <span className="text-xs text-muted-foreground">Done</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Need help? Email{" "}
        <a className="underline" href="mailto:hello@embi-print.com">
          hello@embi-print.com
        </a>{" "}
        with your order number.
      </p>
    </div>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span>{children}</span>
    </div>
  );
}

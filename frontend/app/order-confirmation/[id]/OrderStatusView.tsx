"use client";

import { useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api";
import { formatUSD } from "@/lib/pricing";
import type { Order, OrderStatus } from "@/lib/types";

const STAGES: { key: OrderStatus; label: string }[] = [
  { key: "pending", label: "Awaiting payment" },
  { key: "paid", label: "Payment confirmed" },
  { key: "submitted_to_printful", label: "Sent to fulfillment" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
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
      <p className="mt-6 text-sm text-red-600">
        Couldn&apos;t load order status: {error}
      </p>
    );
  }

  if (!order) {
    return <p className="mt-6 text-sm text-neutral-500">Loading…</p>;
  }

  const currentIdx = STAGES.findIndex((s) => s.key === order.status);

  return (
    <div className="mt-6 space-y-6">
      <dl className="rounded border border-neutral-200 bg-neutral-50 p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-neutral-600">Order</dt>
          <dd className="font-mono text-xs">{order.id}</dd>
        </div>
        <div className="mt-1 flex justify-between">
          <dt className="text-neutral-600">Total</dt>
          <dd className="font-medium">{formatUSD(order.total_price)}</dd>
        </div>
        {order.tracking_number && (
          <div className="mt-1 flex justify-between">
            <dt className="text-neutral-600">Tracking</dt>
            <dd className="font-mono text-xs">{order.tracking_number}</dd>
          </div>
        )}
      </dl>

      <ol className="space-y-3">
        {STAGES.map((stage, idx) => {
          const reached = idx <= currentIdx;
          const active = idx === currentIdx;
          return (
            <li
              key={stage.key}
              className="flex items-center gap-3 text-sm"
              data-testid={`stage-${stage.key}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  reached
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-300 text-neutral-400"
                }`}
              >
                {reached ? "✓" : idx + 1}
              </span>
              <span
                className={
                  active
                    ? "font-medium text-neutral-900"
                    : reached
                      ? "text-neutral-700"
                      : "text-neutral-400"
                }
              >
                {stage.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

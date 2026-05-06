import { Suspense } from "react";
import { CheckoutPanel } from "./CheckoutPanel";

export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <a href="/" className="text-sm text-neutral-500 hover:underline">
        ← Back
      </a>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Checkout</h1>
      <Suspense fallback={<p className="mt-6 text-neutral-500">Loading…</p>}>
        <CheckoutPanel />
      </Suspense>
    </main>
  );
}

import { Suspense } from "react";

import { SiteHeader } from "@/components/SiteHeader";
import { CheckoutPanel } from "./CheckoutPanel";

export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return (
    <div className="min-h-svh">
      <SiteHeader back={{ href: "/", label: "Continue shopping" }} />
      <main className="container max-w-3xl py-8 md:py-12">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight md:text-3xl">
          Checkout
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Just a couple of details and we&apos;ll get to stitching.
        </p>

        <Suspense
          fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
        >
          <CheckoutPanel />
        </Suspense>
      </main>
    </div>
  );
}

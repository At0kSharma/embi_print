import { ChevronLeft } from "lucide-react";
import { Suspense } from "react";

import { CheckoutPanel } from "./CheckoutPanel";

export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="container flex h-14 max-w-6xl items-center justify-between">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </a>
          <a href="/" className="flex items-center gap-2 text-sm font-semibold">
            <span className="inline-block h-4 w-4 rounded-sm bg-foreground" />
            embi_print
          </a>
        </div>
      </header>

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

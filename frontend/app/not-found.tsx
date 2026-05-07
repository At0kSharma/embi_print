import { Compass } from "lucide-react";
import Link from "next/link";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-svh">
      <SiteHeader />
      <main className="container max-w-xl py-20 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Compass className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          404
        </p>
        <h1 className="mb-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          We couldn&apos;t find that.
        </h1>
        <p className="mb-8 text-pretty text-sm text-muted-foreground">
          Either the URL is wrong, or the product was removed from the
          catalog. Either way, here&apos;s how to get back on track.
        </p>
        <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/">Browse all products</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/checkout">View cart</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}

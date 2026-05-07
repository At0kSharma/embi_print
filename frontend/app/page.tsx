import { Sparkles } from "lucide-react";

import { CatalogShell } from "@/components/CatalogShell";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let products: Product[];
  let fetchError: string | null = null;
  try {
    products = await api.listProducts();
  } catch (e) {
    fetchError = e instanceof Error ? e.message : String(e);
    products = [];
  }

  return (
    <div className="min-h-svh">
      <SiteHeader />

      <main className="container max-w-6xl py-12 md:py-20">
        {/* Hero */}
        <section className="mb-12 max-w-3xl">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3 w-3" />
            Made to order
          </span>
          <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            Custom apparel,{" "}
            <span className="text-primary">on demand</span>.
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-base text-muted-foreground md:text-lg">
            Tees, hoodies, jackets, caps. Upload a logo, place it where you
            want, and we&apos;ll embroider or print it and ship it. No
            minimums.
          </p>
        </section>

        {fetchError && (
          <div className="mb-8 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Couldn&apos;t reach the API: {fetchError}
          </div>
        )}

        {products.length === 0 && !fetchError ? (
          <div className="rounded-md border border-dashed bg-muted/30 p-10 text-center text-sm text-muted-foreground">
            No products yet. Run the seed script.
          </div>
        ) : (
          <CatalogShell products={products} />
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="border-b">
      <div className="container flex h-14 max-w-6xl items-center justify-between">
        <a
          href="/"
          className="flex items-center gap-2 text-base font-semibold tracking-tight"
        >
          <span className="inline-block h-5 w-5 rounded-sm bg-primary" />
          embi_print
        </a>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#" className="hover:text-foreground">
            How it works
          </a>
          <a href="#" className="hover:text-foreground">
            Materials
          </a>
          <a href="#" className="hover:text-foreground">
            Support
          </a>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-16 border-t">
      <div className="container flex max-w-6xl flex-col items-start justify-between gap-2 py-6 text-sm text-muted-foreground md:flex-row md:items-center">
        <p>© {new Date().getFullYear()} embi_print. All threads reserved.</p>
        <p className="text-xs">Made to order. Shipped in days.</p>
      </div>
    </footer>
  );
}

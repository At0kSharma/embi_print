import { ChevronLeft } from "lucide-react";

import { api } from "@/lib/api";
import { Customizer } from "./Customizer";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: { id: string };
}) {
  let product;
  try {
    product = await api.getProduct(params.id);
  } catch {
    return (
      <main className="container max-w-3xl py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Product not found</h1>
        <p className="mt-2 text-muted-foreground">
          That product doesn&apos;t exist or is no longer available.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center gap-1 text-sm underline underline-offset-4 hover:no-underline"
        >
          <ChevronLeft className="h-4 w-4" /> Back to all products
        </a>
      </main>
    );
  }

  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="container flex h-14 max-w-6xl items-center justify-between">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            All products
          </a>
          <a href="/" className="flex items-center gap-2 text-sm font-semibold">
            <span className="inline-block h-4 w-4 rounded-sm bg-foreground" />
            embi_print
          </a>
        </div>
      </header>

      <main className="container max-w-6xl py-8 md:py-12">
        <Customizer product={product} />
      </main>
    </div>
  );
}

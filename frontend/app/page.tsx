import { ProductCard } from "@/components/ProductCard";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";

// Always fetch fresh — products list rarely changes but we don't want
// stale price data after a backend update.
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
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">embi_print</h1>
        <p className="mt-1 text-neutral-600">
          Custom embroidery on demand — upload your logo, ships in days.
        </p>
      </header>

      {fetchError && (
        <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t reach the API: {fetchError}
        </div>
      )}

      {products.length === 0 && !fetchError && (
        <p className="text-neutral-600">No products yet. Run the seed script.</p>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </main>
  );
}

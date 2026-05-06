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
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-neutral-600">Product not found.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <a href="/" className="text-sm text-neutral-500 hover:underline">
        ← All products
      </a>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{product.name}</h1>
      <Customizer product={product} />
    </main>
  );
}

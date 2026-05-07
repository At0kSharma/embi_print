import { SiteHeader } from "@/components/SiteHeader";
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
      <div className="min-h-svh">
        <SiteHeader back={{ href: "/", label: "All products" }} />
        <main className="container max-w-3xl py-16 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Product not found
          </h1>
          <p className="mt-2 text-muted-foreground">
            That product doesn&apos;t exist or is no longer available.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-svh">
      <SiteHeader back={{ href: "/", label: "All products" }} />
      <main className="container max-w-6xl py-8 md:py-12">
        <Customizer product={product} />
      </main>
    </div>
  );
}

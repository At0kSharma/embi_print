import { Plus } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { adminApi } from "@/lib/admin-api";
import { formatUSD } from "@/lib/pricing";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  let products: Product[];
  let error: string | null = null;
  try {
    products = await adminApi.listProducts();
  } catch (e) {
    products = [];
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="container max-w-6xl py-8 md:py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            {products.length} {products.length === 1 ? "product" : "products"} in catalog
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus className="mr-2 h-4 w-4" /> New product
          </Link>
        </Button>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {products.length === 0 && !error ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductRow key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductRow({ product }: { product: Product }) {
  return (
    <Card className="overflow-hidden transition-all hover:border-foreground/30">
      <CardContent className="space-y-2 p-5">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/admin/products/${product.id}`}
            className="text-sm font-semibold hover:underline"
          >
            {product.name}
          </Link>
          <Badge variant="secondary" className="text-[10px] uppercase">
            {product.type}
          </Badge>
        </div>
        <div className="flex items-baseline justify-between text-xs text-muted-foreground">
          <code className="font-mono">{product.slug}</code>
          <span className="tabular-nums">{formatUSD(product.base_price)}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge variant="outline" className="text-[10px]">
            {product.print_method}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {product.variants.length} variants
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {product.zones.length} zones
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="rounded-md border border-dashed bg-background p-10 text-center text-sm text-muted-foreground">
      No products yet. Click <strong>New product</strong> to add the first one.
    </div>
  );
}

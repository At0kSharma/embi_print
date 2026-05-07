import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { primaryMockupSrc } from "@/lib/mockups";
import { formatUSD } from "@/lib/pricing";
import type { Product } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  shirt: "T-Shirt",
  hoodie: "Hoodie",
  jacket: "Jacket",
  cap: "Cap",
  beanie: "Beanie",
};

export function ProductCard({ product }: { product: Product }) {
  const colorCount = new Set(product.variants.map((v) => v.color)).size;
  const sizeCount = new Set(product.variants.map((v) => v.size)).size;

  return (
    <Link href={`/products/${product.id}`} className="group block">
      <Card className="overflow-hidden border-border/60 transition-all duration-300 hover:border-foreground/30 hover:shadow-lg">
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
          <Image
            src={primaryMockupSrc(product)}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-contain p-10 transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute left-3 top-3">
            <Badge variant="secondary" className="rounded-full text-xs">
              {TYPE_LABEL[product.type] ?? product.type}
            </Badge>
          </div>
          <div className="absolute right-3 top-3">
            <Badge variant="secondary" className="rounded-full text-xs">
              {product.zones.length}{" "}
              {product.zones.length === 1 ? "placement" : "placements"}
            </Badge>
          </div>
        </div>

        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold tracking-tight">
                {product.name}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {colorCount} colors · {sizeCount} sizes
              </p>
            </div>
            <div className="flex items-center gap-1 text-sm font-medium tabular-nums">
              <span className="text-muted-foreground">from</span>
              <span>{formatUSD(product.base_price)}</span>
              <ArrowUpRight className="ml-1 h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

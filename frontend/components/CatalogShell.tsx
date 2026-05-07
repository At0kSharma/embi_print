"use client";

import { useMemo, useState } from "react";

import { ProductCard } from "@/components/ProductCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import type { Product } from "@/lib/types";

type SortKey = "featured" | "price-asc" | "price-desc";

const TYPE_LABEL: Record<string, string> = {
  shirt: "T-Shirts",
  hoodie: "Hoodies",
  jacket: "Jackets",
  cap: "Caps",
  beanie: "Beanies",
};

interface Props {
  products: Product[];
}

export function CatalogShell({ products }: Props) {
  const [filter, setFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("featured");

  const types = useMemo(
    () => Array.from(new Set(products.map((p) => p.type))),
    [products],
  );

  const visible = useMemo(() => {
    let xs = filter === "all" ? products : products.filter((p) => p.type === filter);
    if (sort === "price-asc") xs = [...xs].sort((a, b) => a.base_price - b.base_price);
    if (sort === "price-desc") xs = [...xs].sort((a, b) => b.base_price - a.base_price);
    return xs;
  }, [products, filter, sort]);

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => v && setFilter(v)}
          variant="outline"
          className="flex flex-wrap justify-start gap-1.5"
        >
          <ToggleGroupItem
            value="all"
            className="data-[state=on]:bg-foreground data-[state=on]:text-background"
          >
            All
          </ToggleGroupItem>
          {types.map((t) => (
            <ToggleGroupItem
              key={t}
              value={t}
              className="data-[state=on]:bg-foreground data-[state=on]:text-background"
            >
              {TYPE_LABEL[t] ?? t}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort by</span>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="featured">Featured</SelectItem>
              <SelectItem value="price-asc">Price: low → high</SelectItem>
              <SelectItem value="price-desc">Price: high → low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Result count */}
      <p className="mb-4 text-xs text-muted-foreground">
        {visible.length} {visible.length === 1 ? "product" : "products"}
      </p>

      {visible.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-10 text-center text-sm text-muted-foreground">
          Nothing matches that filter yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

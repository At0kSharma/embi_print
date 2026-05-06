// Single source of truth for client-side price preview.
// The server recomputes from authoritative DB rows on POST /orders, so
// this is purely for UI display — never trusted by the backend.

import type { PlacementZone, Product, ProductVariant } from "./types";

export interface PriceBreakdownInput {
  product: Product;
  variant: ProductVariant;
  zone: PlacementZone;
  quantity: number;
}

export interface PriceBreakdown {
  base: number;
  variantDelta: number;
  zoneAddOn: number;
  unit: number;
  total: number;
}

export function computePrice({
  product,
  variant,
  zone,
  quantity,
}: PriceBreakdownInput): PriceBreakdown {
  const base = product.base_price;
  const variantDelta = variant.price_delta;
  const zoneAddOn = zone.add_on_price;
  const unit = base + variantDelta + zoneAddOn;
  return {
    base,
    variantDelta,
    zoneAddOn,
    unit,
    total: unit * quantity,
  };
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

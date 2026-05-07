// Resolves a (product, color, zone) tuple to a mockup PNG URL.
// Priority:
//   1. Admin-uploaded URL stored on Product.mockups (S3/MinIO)
//   2. Public-folder convention /mockups/{slug}/{color_lower}/{view}.png
//      (used by the seeded products which ship their PNGs in /public)

import type { PlacementZone, Product } from "./types";

const BACK_ZONES = new Set(["back", "full_back"]);

function viewFor(zone: PlacementZone | undefined): "front" | "back" {
  return zone && BACK_ZONES.has(zone.name) ? "back" : "front";
}

export function mockupSrc(
  product: Product,
  color: string,
  zone: PlacementZone | undefined,
): string {
  const view = viewFor(zone);
  const lc = color.toLowerCase();
  const dbUrl = product.mockups?.[lc]?.[view];
  if (dbUrl) return dbUrl;
  return `/mockups/${product.slug}/${lc}/${view}.png`;
}

/** Card thumbnail — first variant color, front view. */
export function primaryMockupSrc(product: Product): string {
  const firstColor = (product.variants[0]?.color ?? "white").toLowerCase();
  const dbUrl = product.mockups?.[firstColor]?.front;
  if (dbUrl) return dbUrl;
  return `/mockups/${product.slug}/${firstColor}/front.png`;
}

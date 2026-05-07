import type { MetadataRoute } from "next";

import { api } from "@/lib/api";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let products: { id: string }[] = [];
  try {
    products = await api.listProducts();
  } catch {
    // If the API is unreachable at build time, ship a sitemap with
    // just the home URL rather than failing the build.
  }
  return [
    {
      url: `${SITE_URL}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...products.map((p) => ({
      url: `${SITE_URL}/products/${p.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}

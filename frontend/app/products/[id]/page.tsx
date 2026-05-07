import type { Metadata } from "next";

import { SiteHeader } from "@/components/SiteHeader";
import { api } from "@/lib/api";
import { primaryMockupSrc } from "@/lib/mockups";
import { absoluteUrl, SITE_URL } from "@/lib/site";
import { Customizer } from "./Customizer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  try {
    const product = await api.getProduct(params.id);
    const ogImage = absoluteUrl(primaryMockupSrc(product));
    const description =
      product.description ??
      `Customize and order your ${product.name.toLowerCase()} from embi_print.`;
    return {
      title: product.name,
      description,
      alternates: { canonical: `${SITE_URL}/products/${product.id}` },
      openGraph: {
        title: product.name,
        description,
        url: `${SITE_URL}/products/${product.id}`,
        type: "website",
        images: [{ url: ogImage, width: 800, height: 1000, alt: product.name }],
      },
      twitter: {
        card: "summary_large_image",
        title: product.name,
        description,
        images: [ogImage],
      },
    };
  } catch {
    return { title: "Product not found" };
  }
}

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

  const colors = Array.from(new Set(product.variants.map((v) => v.color)));
  const lowestPrice =
    product.base_price +
    Math.min(0, ...product.variants.map((v) => v.price_delta));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    image: absoluteUrl(primaryMockupSrc(product)),
    sku: product.slug,
    category: product.type,
    color: colors.join(", "),
    brand: { "@type": "Brand", name: "embi_print" },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: lowestPrice.toFixed(2),
      offerCount: product.variants.length,
      availability: "https://schema.org/MadeToOrder",
    },
  };

  return (
    <div className="min-h-svh">
      <SiteHeader back={{ href: "/", label: "All products" }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="container max-w-6xl py-8 md:py-12">
        <Customizer product={product} />
      </main>
    </div>
  );
}

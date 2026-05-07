import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { adminApi } from "@/lib/admin-api";

import { ProductEditor } from "./ProductEditor";

export const dynamic = "force-dynamic";

export default async function AdminProductPage({
  params,
}: {
  params: { id: string };
}) {
  let product;
  try {
    product = await adminApi.getProduct(params.id);
  } catch {
    notFound();
  }

  return (
    <div className="container max-w-4xl py-8 md:py-10">
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> All products
      </Link>
      <ProductEditor product={product} />
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatUSD } from "@/lib/pricing";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="block rounded-lg border border-neutral-200 bg-white p-6 transition hover:border-neutral-400 hover:shadow-md"
    >
      <div className="relative mb-4 aspect-square w-full overflow-hidden rounded bg-neutral-100">
        <Image
          src="/mockups/white/front.png"
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-contain"
        />
      </div>
      <h2 className="text-lg font-semibold">{product.name}</h2>
      <p className="text-sm text-neutral-500">From {formatUSD(product.base_price)}</p>
    </Link>
  );
}

"use client";

import type { ProductVariant } from "@/lib/types";

interface Props {
  variants: ProductVariant[];
  selectedColor: string;
  selectedSize: string;
  onSelect: (color: string, size: string) => void;
}

export function VariantPicker({
  variants,
  selectedColor,
  selectedSize,
  onSelect,
}: Props) {
  const colors = Array.from(new Set(variants.map((v) => v.color)));
  const sizes = Array.from(new Set(variants.map((v) => v.size))).sort(
    (a, b) => sizeOrder(a) - sizeOrder(b),
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium text-neutral-700">Color</p>
        <div className="flex gap-2">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onSelect(c, selectedSize)}
              className={`rounded border px-4 py-2 text-sm transition ${
                c === selectedColor
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white hover:border-neutral-500"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-neutral-700">Size</p>
        <div className="flex gap-2">
          {sizes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSelect(selectedColor, s)}
              className={`rounded border px-4 py-2 text-sm transition ${
                s === selectedSize
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white hover:border-neutral-500"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function sizeOrder(size: string): number {
  const order = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
  const i = order.indexOf(size);
  return i === -1 ? 99 : i;
}

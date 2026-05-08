"use client";

import { Check } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { ProductVariant } from "@/lib/types";

interface Props {
  variants: ProductVariant[];
  selectedColor: string;
  selectedSize: string;
  onSelect: (color: string, size: string) => void;
}

// Fallback when a variant doesn't carry a hex_color (e.g. legacy rows
// pre-migration or admin forgot to set one). Anything not here renders
// as muted grey, which still works visually.
const FALLBACK_HEX: Record<string, string> = {
  White: "#F5F0E8",
  Black: "#111111",
  Navy: "#1B2A4A",
  Forest: "#1F4D3F",
  Charcoal: "#3C3C42",
};

function swatchHex(variant: { color: string; hex_color: string | null }): string {
  return variant.hex_color ?? FALLBACK_HEX[variant.color] ?? "#9CA3AF";
}

export function VariantPicker({
  variants,
  selectedColor,
  selectedSize,
  onSelect,
}: Props) {
  // De-duplicate by color but keep the first hex we see for that color
  // — if the admin set inconsistent hex per size (they shouldn't), the
  // first variant wins.
  const colors = Array.from(
    new Map(variants.map((v) => [v.color, v])).values(),
  );
  const sizes = Array.from(new Set(variants.map((v) => v.size))).sort(
    (a, b) => sizeOrder(a) - sizeOrder(b),
  );

  return (
    <div className="space-y-5">
      {/* Color */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label className="text-sm font-medium">Color</Label>
          <span className="text-xs text-muted-foreground">{selectedColor}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {colors.map((variant) => {
            const c = variant.color;
            const isSelected = c === selectedColor;
            const hex = swatchHex(variant);
            const isLight = isLightColor(hex);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={isSelected}
                aria-label={c}
                onClick={() => onSelect(c, selectedSize)}
                className={cn(
                  "relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-all",
                  "ring-1 ring-border hover:ring-foreground/40",
                  isSelected &&
                    "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                )}
                style={{ backgroundColor: hex }}
              >
                {isSelected && (
                  <Check
                    className={cn(
                      "h-4 w-4",
                      isLight ? "text-foreground" : "text-background",
                    )}
                    strokeWidth={2.5}
                  />
                )}
                <span className="sr-only">{c}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Size */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label className="text-sm font-medium">Size</Label>
          <span className="text-xs text-muted-foreground">{selectedSize}</span>
        </div>
        <ToggleGroup
          type="single"
          value={selectedSize}
          onValueChange={(v) => v && onSelect(selectedColor, v)}
          className="flex flex-wrap justify-start gap-1.5"
          variant="outline"
        >
          {sizes.map((s) => (
            <ToggleGroupItem
              key={s}
              value={s}
              aria-label={`Size ${s}`}
              className="h-10 min-w-[3rem] data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:hover:bg-foreground/90"
            >
              {s}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
}

function sizeOrder(size: string): number {
  const order = ["OS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
  const i = order.indexOf(size);
  return i === -1 ? 99 : i;
}

/**
 * Determine if a hex color is "light" so we know whether to use a dark
 * or light checkmark on top of it. Uses the YIQ luminance formula.
 */
function isLightColor(hex: string): boolean {
  const m = /^#?([0-9A-Fa-f]{6,8})$/.exec(hex);
  if (!m) return false;
  const v = m[1];
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 175;
}

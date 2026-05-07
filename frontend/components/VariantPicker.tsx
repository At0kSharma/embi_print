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

const SWATCH_HEX: Record<string, string> = {
  White: "#FFFFFF",
  Black: "#111111",
  Navy: "#1B2A4A",
  Forest: "#1F4D3F",
};

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
    <div className="space-y-5">
      {/* Color */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label className="text-sm font-medium">Color</Label>
          <span className="text-xs text-muted-foreground">{selectedColor}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {colors.map((c) => {
            const isSelected = c === selectedColor;
            const hex = SWATCH_HEX[c] ?? "#888";
            const isLight = hex.toUpperCase() === "#FFFFFF";
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
  const order = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
  const i = order.indexOf(size);
  return i === -1 ? 99 : i;
}

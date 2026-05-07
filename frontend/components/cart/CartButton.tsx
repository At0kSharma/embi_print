"use client";

import { ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCart } from "./CartProvider";

export function CartButton() {
  const { count, open } = useCart();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={open}
      className="relative"
      aria-label={`Open cart, ${count} ${count === 1 ? "item" : "items"}`}
    >
      <ShoppingBag className="h-4 w-4" />
      <span className="ml-2 text-sm">Cart</span>
      {count > 0 && (
        <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-none text-primary-foreground">
          {count}
        </span>
      )}
    </Button>
  );
}

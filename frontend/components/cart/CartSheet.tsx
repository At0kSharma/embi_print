"use client";

import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatUSD } from "@/lib/pricing";
import type { CartItem } from "@/lib/cart";

import { useCart } from "./CartProvider";

export function CartSheet() {
  const { items, isOpen, close, subtotal } = useCart();
  const router = useRouter();

  const goToCheckout = () => {
    close();
    router.push("/checkout");
  };

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Your cart</SheetTitle>
          <SheetDescription>
            {items.length === 0
              ? "Empty for now."
              : `${items.length} ${items.length === 1 ? "item" : "items"}`}
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <EmptyState onClose={close} />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <ul className="space-y-4">
                {items.map((item) => (
                  <CartLine key={item.id} item={item} />
                ))}
              </ul>
            </div>

            <SheetFooter className="border-t bg-muted/30 px-6 py-4">
              <div className="w-full space-y-3">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold tabular-nums">
                    {formatUSD(subtotal)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tax and shipping calculated at checkout.
                </p>
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  onClick={goToCheckout}
                >
                  Checkout
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CartLine({ item }: { item: CartItem }) {
  const { removeItem, updateQuantity } = useCart();
  const view =
    item.zone_label.toLowerCase().includes("back") ? "back" : "front";
  const thumb = `/mockups/${item.product_slug}/${item.color.toLowerCase()}/${view}.png`;

  return (
    <li className="flex gap-3">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-muted">
        <Image src={thumb} alt={item.product_name} fill className="object-contain p-2" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{item.product_name}</div>
            <div className="text-xs text-muted-foreground">
              {item.color} · {item.size} · {item.zone_label}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => removeItem(item.id)}
            aria-label="Remove from cart"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-1 flex items-center justify-between">
          <div className="inline-flex items-center rounded-md border bg-background">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-r-none"
              onClick={() => updateQuantity(item.id, item.quantity - 1)}
              disabled={item.quantity <= 1}
              aria-label="Decrease quantity"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="flex h-7 min-w-[2rem] items-center justify-center px-1 text-xs tabular-nums">
              {item.quantity}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-l-none"
              onClick={() => updateQuantity(item.id, item.quantity + 1)}
              aria-label="Increase quantity"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <div className="text-sm font-medium tabular-nums">
            {formatUSD(item.unit_price * item.quantity)}
          </div>
        </div>
      </div>
    </li>
  );
}

function EmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <ShoppingBag className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">
        Your cart is empty. Pick a piece, customize a logo, and we&apos;ll
        stitch it.
      </p>
      <Button type="button" variant="outline" onClick={onClose}>
        Browse products
      </Button>
    </div>
  );
}

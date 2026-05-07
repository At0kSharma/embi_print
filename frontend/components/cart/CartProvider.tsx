"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  cartItemCount,
  cartSubtotal,
  clearCart as clearStorage,
  newCartItemId,
  readCart,
  writeCart,
  type CartItem,
} from "@/lib/cart";

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage once on mount; SSR renders an empty cart.
  useEffect(() => {
    setItems(readCart());
    setHydrated(true);
  }, []);

  // Sync to storage on every change after hydration.
  useEffect(() => {
    if (!hydrated) return;
    writeCart(items);
  }, [items, hydrated]);

  const addItem = useCallback((item: Omit<CartItem, "id">) => {
    setItems((prev) => [...prev, { ...item, id: newCartItemId() }]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    const q = Math.max(1, Math.min(100, Math.floor(quantity)));
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, quantity: q } : it)),
    );
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    clearStorage();
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: cartItemCount(items),
      subtotal: cartSubtotal(items),
      isOpen,
      open: () => setOpen(true),
      close: () => setOpen(false),
      addItem,
      removeItem,
      updateQuantity,
      clear,
    }),
    [items, isOpen, addItem, removeItem, updateQuantity, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}

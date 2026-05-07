// Client-side cart storage.
// State lives in localStorage under a single JSON blob; CartProvider
// wraps useState/useEffect to keep React state in sync with storage.

export interface CartItem {
  id: string; // local UUID for keying / removal

  // References — these are the source of truth on the server
  product_id: string;
  variant_id: string;
  zone_id: string;
  upload_id: string;
  quantity: number;

  // Display snapshot — server still authoritatively prices on POST /orders.
  // We capture these at add-to-cart time so the cart UI doesn't depend on
  // a fresh API call to render.
  product_slug: string;
  product_name: string;
  color: string;
  size: string;
  zone_label: string;
  unit_price: number; // for display only; server recomputes
}

const STORAGE_KEY = "embi_cart_v1";

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function clearCart() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);
}

export function cartItemCount(items: CartItem[]): number {
  return items.reduce((sum, it) => sum + it.quantity, 0);
}

export function newCartItemId(): string {
  // crypto.randomUUID is available in modern browsers; fallback for safety.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

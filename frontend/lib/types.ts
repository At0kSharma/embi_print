// Mirrors backend/schemas.py. Keep these in sync — drift causes runtime
// errors only at the boundary, so a quick visual diff after changing
// schemas.py is the cheapest discipline.

// Zone names are open-ended at the backend (any string). Common values:
// left_chest, center_chest, right_chest, full_back, front, back, hood.
export interface PlacementZone {
  id: string;
  name: string;
  add_on_price: number;
  max_width_mm: number;
  max_height_mm: number;
  position_on_mockup: {
    x_pct: number;
    y_pct: number;
    w_pct: number;
    h_pct: number;
  };
}

export interface ProductVariant {
  id: string;
  color: string;
  /** Hex code like "#1B2A4A" — admin-supplied; fallback handled client-side. */
  hex_color: string | null;
  size: string;
  price_delta: number;
  printful_variant_id: string;
}

export type PrintMethod = "embroidery" | "dtg";

export interface Product {
  id: string;
  slug: string;
  name: string;
  type: string;
  description: string | null;
  print_method: PrintMethod;
  base_price: number;
  /** Admin-uploaded mockup image URLs, keyed by color → view → URL. */
  mockups?: Record<string, Record<string, string>> | null;
  zones: PlacementZone[];
  variants: ProductVariant[];
}

export type UploadStatus = "pending" | "processing" | "done" | "failed";

export interface Upload {
  id: string;
  status: UploadStatus;
  stitch_count: number | null;
  original_filename: string;
}

export interface ShippingAddress {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface OrderItemInput {
  variant_id: string;
  zone_id: string;
  upload_id: string;
  quantity: number;
}

export interface OrderCreate {
  customer_name: string;
  customer_email: string;
  shipping_address: ShippingAddress;
  items: OrderItemInput[];
}

export type OrderStatus =
  | "pending"
  | "paid"
  | "submitted_to_printful"
  | "shipped"
  | "delivered";

export interface OrderItem {
  id: string;
  variant_id: string;
  zone_id: string;
  upload_id: string;
  quantity: number;
  unit_price: number;
}

export interface Order {
  id: string;
  status: OrderStatus;
  customer_email: string;
  customer_name: string;
  shipping_address: ShippingAddress;
  total_price: number;
  tracking_number: string | null;
  items: OrderItem[];
}

export interface PaymentIntent {
  client_secret: string;
  payment_intent_id: string;
}

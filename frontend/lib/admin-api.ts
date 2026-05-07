// Server-side admin API client. Reads the incoming Authorization
// header (Basic, gated by middleware.ts) and forwards it to the
// backend. Only safe to import from Server Components and Server
// Actions — never from client code.

import { headers } from "next/headers";

import type { Product } from "./types";

const API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

class AdminApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(`admin API ${status}: ${detail}`);
  }
}

function authHeader(): string {
  const auth = headers().get("authorization");
  if (!auth) {
    throw new AdminApiError(401, "Missing Authorization header");
  }
  return auth;
}

async function request<T>(
  path: string,
  init?: RequestInit & { body?: BodyInit | null },
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      ...(init?.body && !(init?.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail: string;
    try {
      const body = await res.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch {
      detail = res.statusText;
    }
    throw new AdminApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface AdminOrder {
  id: string;
  status: string;
  customer_email: string;
  customer_name: string;
  total_price: number;
  created_at: string;
  item_count: number;
}

export const adminApi = {
  listProducts(): Promise<Product[]> {
    return request<Product[]>("/admin/products");
  },
  getProduct(id: string): Promise<Product> {
    return request<Product>(`/admin/products/${id}`);
  },
  createProduct(payload: {
    slug: string;
    name: string;
    type: string;
    description?: string | null;
    print_method: "embroidery" | "dtg";
    base_price: number;
  }): Promise<Product> {
    return request<Product>("/admin/products", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateProduct(
    id: string,
    payload: Partial<{
      name: string;
      type: string;
      description: string | null;
      print_method: "embroidery" | "dtg";
      base_price: number;
    }>,
  ): Promise<Product> {
    return request<Product>(`/admin/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  deleteProduct(id: string): Promise<void> {
    return request<void>(`/admin/products/${id}`, { method: "DELETE" });
  },
  addVariant(
    productId: string,
    payload: {
      color: string;
      size: string;
      printful_variant_id: string;
      price_delta: number;
    },
  ): Promise<Product> {
    return request<Product>(`/admin/products/${productId}/variants`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  deleteVariant(id: string): Promise<void> {
    return request<void>(`/admin/variants/${id}`, { method: "DELETE" });
  },
  addZone(
    productId: string,
    payload: {
      name: string;
      add_on_price: number;
      max_width_mm: number;
      max_height_mm: number;
      position_on_mockup: { x_pct: number; y_pct: number; w_pct: number; h_pct: number };
    },
  ): Promise<Product> {
    return request<Product>(`/admin/products/${productId}/zones`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateZone(
    id: string,
    payload: Partial<{
      name: string;
      add_on_price: number;
      max_width_mm: number;
      max_height_mm: number;
      position_on_mockup: { x_pct: number; y_pct: number; w_pct: number; h_pct: number };
    }>,
  ): Promise<Product> {
    return request<Product>(`/admin/zones/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  deleteZone(id: string): Promise<void> {
    return request<void>(`/admin/zones/${id}`, { method: "DELETE" });
  },
  uploadMockup(productId: string, formData: FormData): Promise<Product> {
    return request<Product>(`/admin/products/${productId}/mockups`, {
      method: "POST",
      body: formData,
    });
  },
  listOrders(): Promise<AdminOrder[]> {
    return request<AdminOrder[]>("/admin/orders");
  },
};

export { AdminApiError };

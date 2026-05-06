// Typed fetch wrappers around the FastAPI backend.
// Uses NEXT_PUBLIC_API_URL so the same code runs in dev (localhost:8000)
// and production (Railway / DO).

import type {
  Order,
  OrderCreate,
  PaymentIntent,
  Product,
  Upload,
} from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(`API ${status}: ${detail}`);
  }
}

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail: string;
    try {
      const body = await res.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch {
      detail = res.statusText;
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listProducts(): Promise<Product[]> {
    return request<Product[]>("/products/");
  },

  getProduct(id: string): Promise<Product> {
    return request<Product>(`/products/${id}`);
  },

  uploadLogo(file: File): Promise<Upload> {
    const form = new FormData();
    form.append("file", file);
    // Don't set Content-Type header — fetch sets the multipart boundary itself.
    return fetch(`${API_URL}/uploads/`, { method: "POST", body: form }).then(
      async (res) => {
        if (!res.ok) {
          const detail = await res.text();
          throw new ApiError(res.status, detail);
        }
        return res.json();
      }
    );
  },

  getUpload(id: string): Promise<Upload> {
    return request<Upload>(`/uploads/${id}`);
  },

  createOrder(payload: OrderCreate): Promise<Order> {
    return request<Order>("/orders/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getOrder(id: string): Promise<Order> {
    return request<Order>(`/orders/${id}`);
  },

  createPaymentIntent(orderId: string): Promise<PaymentIntent> {
    return request<PaymentIntent>(`/orders/${orderId}/payment-intent`, {
      method: "POST",
    });
  },
};

export { ApiError };

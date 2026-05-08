"use server";

import { revalidatePath } from "next/cache";

import { adminApi } from "@/lib/admin-api";
import type { Product } from "@/lib/types";

interface CreateProductInput {
  slug: string;
  name: string;
  type: string;
  description: string | null;
  print_method: "embroidery" | "dtg";
  base_price: number;
}

export async function createProductAction(
  input: CreateProductInput,
): Promise<Product> {
  const product = await adminApi.createProduct(input);
  revalidatePath("/admin");
  return product;
}

export async function updateProductAction(
  id: string,
  input: Partial<{
    name: string;
    type: string;
    description: string | null;
    print_method: "embroidery" | "dtg";
    base_price: number;
  }>,
): Promise<Product> {
  const product = await adminApi.updateProduct(id, input);
  revalidatePath("/admin");
  revalidatePath(`/admin/products/${id}`);
  return product;
}

export async function deleteProductAction(id: string): Promise<void> {
  await adminApi.deleteProduct(id);
  revalidatePath("/admin");
}

export async function addVariantAction(
  productId: string,
  input: {
    color: string;
    hex_color?: string | null;
    size: string;
    printful_variant_id: string;
    price_delta: number;
  },
): Promise<Product> {
  const product = await adminApi.addVariant(productId, input);
  revalidatePath(`/admin/products/${productId}`);
  return product;
}

export async function deleteVariantAction(
  productId: string,
  variantId: string,
): Promise<void> {
  await adminApi.deleteVariant(variantId);
  revalidatePath(`/admin/products/${productId}`);
}

export async function addZoneAction(
  productId: string,
  input: {
    name: string;
    add_on_price: number;
    max_width_mm: number;
    max_height_mm: number;
    position_on_mockup: { x_pct: number; y_pct: number; w_pct: number; h_pct: number };
  },
): Promise<Product> {
  const product = await adminApi.addZone(productId, input);
  revalidatePath(`/admin/products/${productId}`);
  return product;
}

export async function updateZoneAction(
  productId: string,
  zoneId: string,
  input: Partial<{
    name: string;
    add_on_price: number;
    max_width_mm: number;
    max_height_mm: number;
    position_on_mockup: { x_pct: number; y_pct: number; w_pct: number; h_pct: number };
  }>,
): Promise<Product> {
  const product = await adminApi.updateZone(zoneId, input);
  revalidatePath(`/admin/products/${productId}`);
  return product;
}

export async function deleteZoneAction(
  productId: string,
  zoneId: string,
): Promise<void> {
  await adminApi.deleteZone(zoneId);
  revalidatePath(`/admin/products/${productId}`);
}

export async function uploadMockupAction(
  productId: string,
  formData: FormData,
): Promise<Product> {
  const product = await adminApi.uploadMockup(productId, formData);
  revalidatePath(`/admin/products/${productId}`);
  return product;
}

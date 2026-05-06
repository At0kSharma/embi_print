"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { LogoUploader } from "@/components/LogoUploader";
import { MockupCanvas } from "@/components/MockupCanvas";
import { PriceBreakdown } from "@/components/PriceBreakdown";
import { VariantPicker } from "@/components/VariantPicker";
import { ZonePicker } from "@/components/ZonePicker";
import type { Product, Upload } from "@/lib/types";
import { computePrice } from "@/lib/pricing";

interface Props {
  product: Product;
}

const FIRST = <T,>(xs: T[]): T => xs[0];

export function Customizer({ product }: Props) {
  const colors = Array.from(new Set(product.variants.map((v) => v.color)));
  const sizes = Array.from(new Set(product.variants.map((v) => v.size)));

  const [color, setColor] = useState(FIRST(colors));
  const [size, setSize] = useState(FIRST(sizes));
  const [zoneId, setZoneId] = useState(FIRST(product.zones).id);
  const [quantity, setQuantity] = useState(1);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  const router = useRouter();

  const variant = product.variants.find(
    (v) => v.color === color && v.size === size,
  );
  const zone = product.zones.find((z) => z.id === zoneId);

  const breakdown = useMemo(() => {
    if (!variant || !zone) return null;
    return computePrice({ product, variant, zone, quantity });
  }, [product, variant, zone, quantity]);

  const mockupView = zone?.name === "full_back" ? "back" : "front";
  const mockupSrc = `/mockups/${color.toLowerCase()}/${mockupView}.png`;

  const canCheckout = upload != null && variant != null && zone != null;

  const proceedToCheckout = () => {
    if (!canCheckout) return;
    const params = new URLSearchParams({
      product_id: product.id,
      variant_id: variant.id,
      zone_id: zone.id,
      upload_id: upload.id,
      quantity: String(quantity),
    });
    router.push(`/checkout?${params.toString()}`);
  };

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-2">
      <div>
        {zone && (
          <MockupCanvas
            mockupSrc={mockupSrc}
            logoSrc={logoPreviewUrl}
            zone={zone}
          />
        )}
      </div>

      <div className="space-y-6">
        <VariantPicker
          variants={product.variants}
          selectedColor={color}
          selectedSize={size}
          onSelect={(c, s) => {
            setColor(c);
            setSize(s);
          }}
        />

        <ZonePicker
          zones={product.zones}
          selectedZoneId={zoneId}
          onSelect={setZoneId}
        />

        <div>
          <label className="text-sm font-medium text-neutral-700">
            Logo
          </label>
          <div className="mt-2">
            <LogoUploader
              onUploaded={(u, preview) => {
                setUpload(u);
                setLogoPreviewUrl(preview);
              }}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="quantity"
            className="block text-sm font-medium text-neutral-700"
          >
            Quantity
          </label>
          <input
            id="quantity"
            type="number"
            min={1}
            max={100}
            value={quantity}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              setQuantity(Number.isFinite(v) && v >= 1 ? v : 1);
            }}
            className="mt-1 w-24 rounded border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        {breakdown && <PriceBreakdown breakdown={breakdown} quantity={quantity} />}

        <button
          type="button"
          disabled={!canCheckout}
          onClick={proceedToCheckout}
          className="w-full rounded bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {canCheckout
            ? "Proceed to Checkout"
            : "Upload a logo to continue"}
        </button>
      </div>
    </div>
  );
}

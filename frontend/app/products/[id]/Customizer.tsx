"use client";

import { Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { LogoUploader } from "@/components/LogoUploader";
import { MockupCanvas } from "@/components/MockupCanvas";
import { PriceBreakdown } from "@/components/PriceBreakdown";
import { VariantPicker } from "@/components/VariantPicker";
import { ZonePicker } from "@/components/ZonePicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { computePrice } from "@/lib/pricing";
import type { Product, Upload } from "@/lib/types";

const FIRST = <T,>(xs: T[]): T => xs[0];

export function Customizer({ product }: { product: Product }) {
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
    <div className="grid gap-8 lg:grid-cols-[1fr_minmax(360px,420px)]">
      {/* Left: preview (sticky on desktop) */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight md:text-3xl">
          {product.name}
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Customize and preview before you commit. We confirm the design with
          you before stitching.
        </p>
        {zone && (
          <MockupCanvas
            mockupSrc={mockupSrc}
            logoSrc={logoPreviewUrl}
            zone={zone}
          />
        )}
      </div>

      {/* Right: configuration */}
      <div className="space-y-6">
        <Section title="1. Choose your shirt">
          <VariantPicker
            variants={product.variants}
            selectedColor={color}
            selectedSize={size}
            onSelect={(c, s) => {
              setColor(c);
              setSize(s);
            }}
          />
        </Section>

        <Separator />

        <Section title="2. Pick a placement">
          <ZonePicker
            zones={product.zones}
            selectedZoneId={zoneId}
            onSelect={setZoneId}
          />
        </Section>

        <Separator />

        <Section title="3. Upload your logo">
          <LogoUploader
            onUploaded={(u, preview) => {
              setUpload(u);
              setLogoPreviewUrl(preview);
            }}
          />
        </Section>

        <Separator />

        <Section title="4. Quantity">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center rounded-md border bg-card">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-r-none"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span
                className="flex h-10 min-w-[3rem] items-center justify-center px-2 text-sm font-medium tabular-nums"
                aria-live="polite"
              >
                {quantity}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-l-none"
                onClick={() => setQuantity((q) => Math.min(100, q + 1))}
                disabled={quantity >= 100}
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Label className="text-sm text-muted-foreground">
              Up to 100 per order
            </Label>
          </div>
        </Section>

        {breakdown && <PriceBreakdown breakdown={breakdown} quantity={quantity} />}

        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={!canCheckout}
          onClick={proceedToCheckout}
        >
          {canCheckout ? "Proceed to checkout" : "Upload a logo to continue"}
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

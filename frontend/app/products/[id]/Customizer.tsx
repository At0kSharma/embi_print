"use client";

import { Minus, Plus, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { LogoUploader } from "@/components/LogoUploader";
import { MockupCanvas } from "@/components/MockupCanvas";
import { PriceBreakdown } from "@/components/PriceBreakdown";
import { VariantPicker } from "@/components/VariantPicker";
import { ZonePicker } from "@/components/ZonePicker";
import { useCart } from "@/components/cart/CartProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { mockupSrc } from "@/lib/mockups";
import { computePrice } from "@/lib/pricing";
import type { Product, Upload } from "@/lib/types";

const PRINT_METHOD_LABEL: Record<string, string> = {
  embroidery: "Embroidered",
  dtg: "Direct-to-garment",
};

const ZONE_LABEL: Record<string, string> = {
  left_chest: "Left chest",
  center_chest: "Center chest",
  right_chest: "Right chest",
  full_back: "Full back",
  front: "Front",
  back: "Back",
  hood: "Hood",
};

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

  const cart = useCart();

  const variant = product.variants.find(
    (v) => v.color === color && v.size === size,
  );
  const zone = product.zones.find((z) => z.id === zoneId);

  const breakdown = useMemo(() => {
    if (!variant || !zone) return null;
    return computePrice({ product, variant, zone, quantity });
  }, [product, variant, zone, quantity]);

  const currentMockupSrc = mockupSrc(product, color, zone);

  const canAdd = upload != null && variant != null && zone != null && breakdown != null;

  const handleAddToCart = () => {
    if (!canAdd) return;
    cart.addItem({
      product_id: product.id,
      variant_id: variant.id,
      zone_id: zone.id,
      upload_id: upload.id,
      quantity,
      product_slug: product.slug,
      product_name: product.name,
      color,
      size,
      zone_label: ZONE_LABEL[zone.name] ?? zone.name,
      unit_price: breakdown.unit,
    });
    toast.success("Added to cart", {
      description: `${product.name} · ${color} · ${size}`,
    });
    cart.open();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_minmax(360px,420px)]">
      {/* Left: preview (sticky on desktop) */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {PRINT_METHOD_LABEL[product.print_method] ?? product.print_method}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {product.zones.length}{" "}
            {product.zones.length === 1 ? "placement" : "placements"} available
          </span>
        </div>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight md:text-3xl">
          {product.name}
        </h1>
        {product.description && (
          <p className="mb-6 max-w-prose text-sm text-muted-foreground">
            {product.description}
          </p>
        )}
        {zone && (
          <MockupCanvas
            mockupSrc={currentMockupSrc}
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
            printMethod={product.print_method}
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
          disabled={!canAdd}
          onClick={handleAddToCart}
        >
          {canAdd ? (
            <>
              <ShoppingBag className="mr-2 h-4 w-4" />
              Add to cart
            </>
          ) : (
            "Upload a logo to continue"
          )}
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
  // Split a leading "1." / "2." etc. from the rest so we can color it.
  const m = /^(\d+\.)\s+(.*)$/.exec(title);
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold tracking-tight text-foreground">
        {m ? (
          <>
            <span className="text-primary">{m[1]}</span>{" "}
            <span>{m[2]}</span>
          </>
        ) : (
          title
        )}
      </h2>
      {children}
    </section>
  );
}

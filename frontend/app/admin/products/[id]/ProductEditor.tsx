"use client";

import { ExternalLink, Loader2, Pencil, Plus, Save, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ZoneVisualEditor } from "./ZoneVisualEditor";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Product } from "@/lib/types";

import {
  addVariantAction,
  addZoneAction,
  deleteProductAction,
  deleteVariantAction,
  deleteZoneAction,
  updateProductAction,
  uploadMockupAction,
} from "../actions";

export function ProductEditor({ product: initialProduct }: { product: Product }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product>(initialProduct);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          <Badge variant="outline">{product.print_method}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          <code>/products/{product.slug}</code>
        </p>
      </div>

      <BasicsCard product={product} onChange={setProduct} />
      <VariantsCard product={product} onChange={setProduct} />
      <ZonesCard product={product} onChange={setProduct} />
      <MockupsCard product={product} onChange={setProduct} />

      <Separator />

      <DangerZone
        productId={product.id}
        onDeleted={() => router.push("/admin")}
      />
    </div>
  );
}

// ── Basics ──────────────────────────────────────────────────────

function BasicsCard({
  product,
  onChange,
}: {
  product: Product;
  onChange: (p: Product) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(product.name);
  const [type, setType] = useState(product.type);
  const [printMethod, setPrintMethod] = useState(product.print_method);
  const [basePrice, setBasePrice] = useState(String(product.base_price));
  const [description, setDescription] = useState(product.description ?? "");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const updated = await updateProductAction(product.id, {
          name,
          type,
          print_method: printMethod,
          base_price: parseFloat(basePrice),
          description: description.trim() || null,
        });
        onChange(updated);
        toast.success("Saved");
      } catch (e) {
        toast.error("Save failed", {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="mb-4 text-sm font-semibold">Basics</h2>
        <form onSubmit={handleSave} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["shirt", "hoodie", "jacket", "cap", "beanie", "polo", "tote", "other"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="print_method">Print method</Label>
            <Select
              value={printMethod}
              onValueChange={(v) => setPrintMethod(v as "embroidery" | "dtg")}
            >
              <SelectTrigger id="print_method"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="embroidery">Embroidery</SelectItem>
                <SelectItem value="dtg">DTG</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="base_price">Base price (USD)</Label>
            <Input
              id="base_price"
              type="number"
              step="0.01"
              min="0"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Variants ────────────────────────────────────────────────────

function VariantsCard({
  product,
  onChange,
}: {
  product: Product;
  onChange: (p: Product) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [color, setColor] = useState("");
  const [hex, setHex] = useState("#111111");
  const [size, setSize] = useState("");
  const [printfulId, setPrintfulId] = useState("");
  const [delta, setDelta] = useState("0");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const updated = await addVariantAction(product.id, {
          color: color.trim(),
          hex_color: hex,
          size: size.trim(),
          printful_variant_id: printfulId.trim(),
          price_delta: parseFloat(delta) || 0,
        });
        onChange(updated);
        setColor("");
        setHex("#111111");
        setSize("");
        setPrintfulId("");
        setDelta("0");
        toast.success("Variant added");
      } catch (e) {
        toast.error("Couldn't add variant", {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  const handleDelete = (variantId: string) => {
    startTransition(async () => {
      try {
        await deleteVariantAction(product.id, variantId);
        onChange({
          ...product,
          variants: product.variants.filter((v) => v.id !== variantId),
        });
        toast.success("Variant removed");
      } catch (e) {
        toast.error("Delete failed", {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Variants</h2>
          <span className="text-xs text-muted-foreground">{product.variants.length} total</span>
        </div>
        {product.variants.length === 0 ? (
          <p className="mb-4 rounded-md border border-dashed bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            No variants yet. Add at least one (color × size) so customers can buy.
          </p>
        ) : (
          <div className="mb-4 max-h-64 overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Color</th>
                  <th className="px-3 py-2 text-left">Size</th>
                  <th className="px-3 py-2 text-left">Printful ID</th>
                  <th className="px-3 py-2 text-right">Δ price</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {product.variants.map((v) => (
                  <tr key={v.id}>
                    <td className="px-3 py-1.5">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full ring-1 ring-border"
                          style={{ backgroundColor: v.hex_color ?? "#9CA3AF" }}
                          aria-hidden
                        />
                        {v.color}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">{v.size}</td>
                    <td className="px-3 py-1.5"><code className="text-xs">{v.printful_variant_id}</code></td>
                    <td className="px-3 py-1.5 text-right tabular-nums">${v.price_delta.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDelete(v.id)}
                        disabled={pending}
                        aria-label="Delete variant"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form
          onSubmit={handleAdd}
          className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_60px_1fr_1fr_100px_auto]"
        >
          <Input
            placeholder="Color (e.g. White)"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            required
          />
          <input
            type="color"
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            aria-label="Swatch color"
            className="h-9 w-full cursor-pointer rounded-md border bg-background p-1"
          />
          <Input
            placeholder="Size (e.g. M)"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            required
          />
          <Input
            placeholder="Printful variant id"
            value={printfulId}
            onChange={(e) => setPrintfulId(e.target.value)}
            required
            className="font-mono text-xs"
          />
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="Δ"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
          />
          <Button type="submit" disabled={pending} size="sm">
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Zones ───────────────────────────────────────────────────────

function ZonesCard({
  product,
  onChange,
}: {
  product: Product;
  onChange: (p: Product) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [addOn, setAddOn] = useState("0");
  const [maxW, setMaxW] = useState("100");
  const [maxH, setMaxH] = useState("100");
  const [x, setX] = useState("0.30");
  const [y, setY] = useState("0.30");
  const [w, setW] = useState("0.40");
  const [h, setH] = useState("0.40");

  const editingZone =
    editingZoneId != null
      ? product.zones.find((z) => z.id === editingZoneId)
      : null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const updated = await addZoneAction(product.id, {
          name: name.trim(),
          add_on_price: parseFloat(addOn) || 0,
          max_width_mm: parseInt(maxW, 10),
          max_height_mm: parseInt(maxH, 10),
          position_on_mockup: {
            x_pct: parseFloat(x),
            y_pct: parseFloat(y),
            w_pct: parseFloat(w),
            h_pct: parseFloat(h),
          },
        });
        onChange(updated);
        setName("");
        toast.success("Zone added");
      } catch (e) {
        toast.error("Couldn't add zone", {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  const handleDelete = (zoneId: string) => {
    startTransition(async () => {
      try {
        await deleteZoneAction(product.id, zoneId);
        onChange({
          ...product,
          zones: product.zones.filter((z) => z.id !== zoneId),
        });
        toast.success("Zone removed");
      } catch (e) {
        toast.error("Delete failed", {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Placement zones</h2>
          <span className="text-xs text-muted-foreground">{product.zones.length} total</span>
        </div>
        {product.zones.length === 0 ? (
          <p className="mb-4 rounded-md border border-dashed bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            No zones yet. Each zone defines where on the garment a logo can be placed.
          </p>
        ) : (
          <ul className="mb-4 space-y-2">
            {product.zones.map((z) => (
              <li key={z.id} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <code className="text-xs">{z.name}</code>
                  <span className="text-xs text-muted-foreground">
                    +${z.add_on_price.toFixed(2)} · {z.max_width_mm}×{z.max_height_mm}mm
                  </span>
                  <span className="text-xs text-muted-foreground">
                    [{z.position_on_mockup.x_pct.toFixed(2)},{z.position_on_mockup.y_pct.toFixed(2)},
                    {z.position_on_mockup.w_pct.toFixed(2)},{z.position_on_mockup.h_pct.toFixed(2)}]
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() =>
                      setEditingZoneId((curr) => (curr === z.id ? null : z.id))
                    }
                    aria-label="Edit zone visually"
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    {editingZoneId === z.id ? "Close" : "Edit"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleDelete(z.id)}
                    disabled={pending}
                    aria-label="Delete zone"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {editingZone && (
          <div className="mb-4">
            <ZoneVisualEditor
              product={product}
              zone={editingZone}
              onSaved={(updated) => {
                onChange(updated);
                setEditingZoneId(null);
              }}
              onClose={() => setEditingZoneId(null)}
            />
          </div>
        )}

        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr]">
            <Input placeholder="Name (e.g. left_chest)" value={name} onChange={(e) => setName(e.target.value)} required className="font-mono text-sm" />
            <Input type="number" step="0.01" placeholder="Add-on $" value={addOn} onChange={(e) => setAddOn(e.target.value)} />
            <Input type="number" placeholder="Max W (mm)" value={maxW} onChange={(e) => setMaxW(e.target.value)} />
            <Input type="number" placeholder="Max H (mm)" value={maxH} onChange={(e) => setMaxH(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <Input type="number" step="0.01" min="0" max="1" placeholder="x_pct" value={x} onChange={(e) => setX(e.target.value)} />
            <Input type="number" step="0.01" min="0" max="1" placeholder="y_pct" value={y} onChange={(e) => setY(e.target.value)} />
            <Input type="number" step="0.01" min="0" max="1" placeholder="w_pct" value={w} onChange={(e) => setW(e.target.value)} />
            <Input type="number" step="0.01" min="0" max="1" placeholder="h_pct" value={h} onChange={(e) => setH(e.target.value)} />
            <Button type="submit" disabled={pending} size="sm">
              <Plus className="mr-1 h-3.5 w-3.5" /> Add zone
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Positions are 0–1 fractions of the mockup width and height.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Mockups ─────────────────────────────────────────────────────

function MockupsCard({
  product,
  onChange,
}: {
  product: Product;
  onChange: (p: Product) => void;
}) {
  const [pending, startTransition] = useTransition();
  const colors = Array.from(new Set(product.variants.map((v) => v.color)));
  const views = ["front", "back"];
  const mockups = product.mockups ?? {};

  const handleUpload = (color: string, view: string, file: File) => {
    const fd = new FormData();
    fd.append("color", color);
    fd.append("view", view);
    fd.append("file", file);

    startTransition(async () => {
      try {
        const updated = await uploadMockupAction(product.id, fd);
        onChange(updated);
        toast.success("Mockup uploaded", { description: `${color} · ${view}` });
      } catch (e) {
        toast.error("Upload failed", {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="mb-1 text-sm font-semibold">Mockups</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Upload one image per (color × view). PNG / JPG / WebP, up to 5 MB each.
          Without uploads, the storefront falls back to{" "}
          <code className="rounded bg-muted px-1 text-[11px]">
            /public/mockups/{product.slug}/&lt;color&gt;/&lt;view&gt;.png
          </code>
          .
        </p>

        {colors.length === 0 ? (
          <p className="rounded-md border border-dashed bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            Add at least one variant first — mockups are tracked per color.
          </p>
        ) : (
          <div className="space-y-4">
            {colors.map((color) => (
              <div key={color}>
                <h3 className="mb-2 text-xs font-medium">{color}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {views.map((view) => {
                    const url = mockups[color.toLowerCase()]?.[view];
                    return (
                      <div key={view} className="rounded-md border bg-muted/20 p-3">
                        <div className="mb-2 flex items-baseline justify-between">
                          <span className="text-xs font-medium capitalize">{view}</span>
                          {url && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                            >
                              open <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <div className="relative mb-2 aspect-square w-full overflow-hidden rounded bg-background ring-1 ring-border">
                          {url ? (
                            <Image
                              src={url}
                              alt={`${color} ${view}`}
                              fill
                              sizes="200px"
                              className="object-contain p-2"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
                              No upload
                            </div>
                          )}
                        </div>
                        <label className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-[11px] font-medium hover:bg-muted">
                          <Upload className="h-3 w-3" />
                          {url ? "Replace" : "Upload"}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            disabled={pending}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUpload(color, view, f);
                              e.currentTarget.value = "";
                            }}
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Danger zone ─────────────────────────────────────────────────

function DangerZone({
  productId,
  onDeleted,
}: {
  productId: string;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteProductAction(productId);
        toast.success("Product deleted");
        onDeleted();
      } catch (e) {
        toast.error("Delete failed", {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  return (
    <Card className="border-destructive/30">
      <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-sm font-semibold text-destructive">Delete product</h2>
          <p className="text-xs text-muted-foreground">
            Removes the product, variants, zones, and mockups. Existing orders
            keep their item rows but lose their product reference. Cannot be
            undone.
          </p>
        </div>
        {!confirming ? (
          <Button
            type="button"
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm delete
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

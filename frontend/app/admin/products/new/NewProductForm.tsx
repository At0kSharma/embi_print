"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createProductAction } from "../actions";

export function NewProductForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("shirt");
  const [printMethod, setPrintMethod] = useState<"embroidery" | "dtg">(
    "embroidery",
  );
  const [basePrice, setBasePrice] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const product = await createProductAction({
        slug: slug.trim(),
        name: name.trim(),
        type: type.trim(),
        description: description.trim() || null,
        print_method: printMethod,
        base_price: parseFloat(basePrice),
      });
      toast.success("Product created", { description: product.name });
      router.push(`/admin/products/${product.id}`);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      toast.error("Couldn't create product", { description: detail });
      setSubmitting(false);
    }
  };

  // Auto-suggest slug from name
  const onNameChange = (v: string) => {
    setName(v);
    if (!slug) {
      setSlug(
        v
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-")
          .slice(0, 80),
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-md border bg-card p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">Product name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Premium Polo"
            required
            maxLength={200}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="premium-polo"
            required
            pattern="[a-z0-9][a-z0-9-]*"
            maxLength={80}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            URL-safe identifier · lowercase · letters / numbers / hyphens
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="type">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["shirt", "hoodie", "jacket", "cap", "beanie", "polo", "tote", "other"].map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
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
            <SelectTrigger id="print_method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="embroidery">Embroidery</SelectItem>
              <SelectItem value="dtg">Direct-to-garment (DTG)</SelectItem>
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
            placeholder="29.00"
            required
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Materials, fit notes, anything customers should know."
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating…
          </>
        ) : (
          "Create product"
        )}
      </Button>
    </form>
  );
}

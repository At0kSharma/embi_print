"use client";

import { Loader2, Save, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { primaryMockupSrc } from "@/lib/mockups";
import type { PlacementZone, Product } from "@/lib/types";

import { updateZoneAction } from "../actions";

interface Props {
  product: Product;
  zone: PlacementZone;
  onSaved: (updated: Product) => void;
  onClose: () => void;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type DragMode =
  | { kind: "move"; startBox: Box; startX: number; startY: number }
  | {
      kind: "resize";
      handle: HandleId;
      startBox: Box;
      startX: number;
      startY: number;
    }
  | null;

type HandleId = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

const MIN_SIZE = 0.04; // 4% minimum

const HANDLE_POSITIONS: Record<HandleId, { x: number; y: number; cursor: string }> = {
  nw: { x: 0, y: 0, cursor: "nwse-resize" },
  n:  { x: 0.5, y: 0, cursor: "ns-resize" },
  ne: { x: 1, y: 0, cursor: "nesw-resize" },
  e:  { x: 1, y: 0.5, cursor: "ew-resize" },
  se: { x: 1, y: 1, cursor: "nwse-resize" },
  s:  { x: 0.5, y: 1, cursor: "ns-resize" },
  sw: { x: 0, y: 1, cursor: "nesw-resize" },
  w:  { x: 0, y: 0.5, cursor: "ew-resize" },
};

export function ZoneVisualEditor({ product, zone, onSaved, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const initial: Box = useMemo(
    () => ({
      x: zone.position_on_mockup.x_pct,
      y: zone.position_on_mockup.y_pct,
      w: zone.position_on_mockup.w_pct,
      h: zone.position_on_mockup.h_pct,
    }),
    [zone],
  );
  const [box, setBox] = useState<Box>(initial);
  const [drag, setDrag] = useState<DragMode>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(zone.name);
  const [addOn, setAddOn] = useState(String(zone.add_on_price));
  const [maxW, setMaxW] = useState(String(zone.max_width_mm));
  const [maxH, setMaxH] = useState(String(zone.max_height_mm));

  // Reset when zone changes
  useEffect(() => {
    setBox(initial);
    setName(zone.name);
    setAddOn(String(zone.add_on_price));
    setMaxW(String(zone.max_width_mm));
    setMaxH(String(zone.max_height_mm));
  }, [zone, initial]);

  const dirty =
    box.x !== initial.x ||
    box.y !== initial.y ||
    box.w !== initial.w ||
    box.h !== initial.h ||
    name !== zone.name ||
    parseFloat(addOn) !== zone.add_on_price ||
    parseInt(maxW, 10) !== zone.max_width_mm ||
    parseInt(maxH, 10) !== zone.max_height_mm;

  // ── Pointer math ──────────────────────────────────────────────

  const containerRect = () => containerRef.current?.getBoundingClientRect();

  const pointerToFraction = useCallback(
    (clientX: number, clientY: number): { fx: number; fy: number } => {
      const rect = containerRect();
      if (!rect) return { fx: 0, fy: 0 };
      return {
        fx: clamp01((clientX - rect.left) / rect.width),
        fy: clamp01((clientY - rect.top) / rect.height),
      };
    },
    [],
  );

  const onPointerDown = (mode: DragMode, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag(mode);
  };

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!drag) return;
      const { fx, fy } = pointerToFraction(e.clientX, e.clientY);
      const dx = fx - drag.startX;
      const dy = fy - drag.startY;

      if (drag.kind === "move") {
        const nx = clamp01(drag.startBox.x + dx);
        const ny = clamp01(drag.startBox.y + dy);
        // Don't push the box past the right/bottom edge
        const cx = Math.min(nx, 1 - drag.startBox.w);
        const cy = Math.min(ny, 1 - drag.startBox.h);
        setBox({ x: cx, y: cy, w: drag.startBox.w, h: drag.startBox.h });
      } else {
        const next = resize(drag.startBox, drag.handle, dx, dy);
        setBox(next);
      }
    },
    [drag, pointerToFraction],
  );

  const onPointerUp = useCallback(() => {
    setDrag(null);
  }, []);

  useEffect(() => {
    if (!drag) return;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [drag, onPointerMove, onPointerUp]);

  // ── Save ──────────────────────────────────────────────────────

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateZoneAction(product.id, zone.id, {
        name: name.trim(),
        add_on_price: parseFloat(addOn) || 0,
        max_width_mm: parseInt(maxW, 10),
        max_height_mm: parseInt(maxH, 10),
        position_on_mockup: {
          x_pct: round4(box.x),
          y_pct: round4(box.y),
          w_pct: round4(box.w),
          h_pct: round4(box.h),
        },
      });
      onSaved(updated);
      toast.success("Zone updated");
    } catch (e) {
      toast.error("Save failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => setBox(initial);

  // ── Render ────────────────────────────────────────────────────

  const mockupSrc = primaryMockupSrc(product);

  return (
    <div className="space-y-4 rounded-md border bg-background p-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold">
            Editing zone: <code className="font-mono">{zone.name}</code>
          </h3>
          <p className="text-xs text-muted-foreground">
            Drag inside the box to move it. Drag the corners or edges to resize.
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close editor">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Visual canvas */}
      <div
        ref={containerRef}
        className="relative aspect-[4/5] w-full max-w-md select-none overflow-hidden rounded-md border bg-muted/30"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mockupSrc}
          alt="Mockup"
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain p-4"
        />

        {/* Bounding box */}
        <div
          className="absolute cursor-move ring-2 ring-primary"
          style={{
            left: `${box.x * 100}%`,
            top: `${box.y * 100}%`,
            width: `${box.w * 100}%`,
            height: `${box.h * 100}%`,
            backgroundColor: "hsl(var(--primary) / 0.15)",
            touchAction: "none",
          }}
          onPointerDown={(e) => {
            const { fx, fy } = pointerToFraction(e.clientX, e.clientY);
            onPointerDown(
              { kind: "move", startBox: box, startX: fx, startY: fy },
              e,
            );
          }}
        >
          {/* Resize handles */}
          {(Object.keys(HANDLE_POSITIONS) as HandleId[]).map((id) => {
            const { x, y, cursor } = HANDLE_POSITIONS[id];
            return (
              <div
                key={id}
                role="button"
                aria-label={`Resize ${id}`}
                onPointerDown={(e) => {
                  const { fx, fy } = pointerToFraction(e.clientX, e.clientY);
                  onPointerDown(
                    {
                      kind: "resize",
                      handle: id,
                      startBox: box,
                      startX: fx,
                      startY: fy,
                    },
                    e,
                  );
                }}
                className="absolute h-3 w-3 rounded-sm border-2 border-primary bg-background shadow-sm"
                style={{
                  left: `${x * 100}%`,
                  top: `${y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  cursor,
                  touchAction: "none",
                }}
              />
            );
          })}

          {/* Live coordinate badge */}
          <div className="pointer-events-none absolute -top-6 left-0 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-mono text-background">
            {box.x.toFixed(2)},{box.y.toFixed(2)} · {box.w.toFixed(2)}×{box.h.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Numeric fallback + meta */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumField label="Name" value={name} onChange={setName} mono />
        <NumField label="Add-on $" value={addOn} onChange={setAddOn} type="number" step="0.01" min="0" />
        <NumField label="Max W (mm)" value={maxW} onChange={setMaxW} type="number" />
        <NumField label="Max H (mm)" value={maxH} onChange={setMaxH} type="number" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        <NumField
          label="x_pct"
          value={box.x.toFixed(3)}
          onChange={(v) => setBox({ ...box, x: clampWithPair(parseFloat(v) || 0, box.w) })}
          type="number"
          step="0.01"
          min="0"
          max="1"
          mono
        />
        <NumField
          label="y_pct"
          value={box.y.toFixed(3)}
          onChange={(v) => setBox({ ...box, y: clampWithPair(parseFloat(v) || 0, box.h) })}
          type="number"
          step="0.01"
          min="0"
          max="1"
          mono
        />
        <NumField
          label="w_pct"
          value={box.w.toFixed(3)}
          onChange={(v) => setBox({ ...box, w: clamp01(Math.max(MIN_SIZE, parseFloat(v) || MIN_SIZE)) })}
          type="number"
          step="0.01"
          min="0.04"
          max="1"
          mono
        />
        <NumField
          label="h_pct"
          value={box.h.toFixed(3)}
          onChange={(v) => setBox({ ...box, h: clamp01(Math.max(MIN_SIZE, parseFloat(v) || MIN_SIZE)) })}
          type="number"
          step="0.01"
          min="0.04"
          max="1"
          mono
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={reset} disabled={!dirty || saving}>
          Reset
        </Button>
        <Button type="button" onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save zone
        </Button>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function clampWithPair(pos: number, dim: number): number {
  // For x position, ensure x + w <= 1
  return Math.min(clamp01(pos), 1 - dim);
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function resize(start: Box, handle: HandleId, dx: number, dy: number): Box {
  let { x, y, w, h } = start;

  if (handle.includes("e")) {
    w = clamp01(start.w + dx);
    if (w < MIN_SIZE) w = MIN_SIZE;
    if (x + w > 1) w = 1 - x;
  }
  if (handle.includes("w")) {
    const nx = clamp01(start.x + dx);
    const newW = start.w - (nx - start.x);
    if (newW >= MIN_SIZE) {
      x = nx;
      w = newW;
    }
  }
  if (handle.includes("s")) {
    h = clamp01(start.h + dy);
    if (h < MIN_SIZE) h = MIN_SIZE;
    if (y + h > 1) h = 1 - y;
  }
  if (handle.includes("n")) {
    const ny = clamp01(start.y + dy);
    const newH = start.h - (ny - start.y);
    if (newH >= MIN_SIZE) {
      y = ny;
      h = newH;
    }
  }

  return { x, y, w, h };
}

function NumField({
  label,
  value,
  onChange,
  mono,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const id = `f-${label.replace(/\s/g, "-")}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 text-xs ${mono ? "font-mono" : ""}`}
        {...rest}
      />
    </div>
  );
}

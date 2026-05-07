"use client";

import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { PlacementZone } from "@/lib/types";

interface Props {
  mockupSrc: string;
  logoSrc: string | null;
  zone: PlacementZone;
}

const ZONE_LABEL: Record<PlacementZone["name"], string> = {
  left_chest: "Left chest",
  center_chest: "Center chest",
  right_chest: "Right chest",
  full_back: "Full back",
};

/**
 * Draws the garment mockup with the uploaded logo overlaid at the zone's
 * percentage coordinates. Pure client work — no backend round-trips.
 */
export function MockupCanvas({ mockupSrc, logoSrc, zone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelled = false;

    const draw = async () => {
      const mockup = await loadImage(mockupSrc);
      if (cancelled) return;

      canvas.width = mockup.naturalWidth;
      canvas.height = mockup.naturalHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(mockup, 0, 0);

      const x = zone.position_on_mockup.x_pct * canvas.width;
      const y = zone.position_on_mockup.y_pct * canvas.height;
      const w = zone.position_on_mockup.w_pct * canvas.width;
      const h = zone.position_on_mockup.h_pct * canvas.height;

      if (logoSrc) {
        try {
          const logo = await loadImage(logoSrc);
          if (cancelled) return;
          const logoRatio = logo.naturalWidth / logo.naturalHeight;
          const zoneRatio = w / h;
          let drawW = w;
          let drawH = h;
          if (logoRatio > zoneRatio) drawH = w / logoRatio;
          else drawW = h * logoRatio;
          const drawX = x + (w - drawW) / 2;
          const drawY = y + (h - drawH) / 2;
          ctx.drawImage(logo, drawX, drawY, drawW, drawH);
        } catch {
          /* skip */
        }
      }

      // Subtle dashed bounding box for the active zone
      ctx.save();
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    };

    draw();
    return () => {
      cancelled = true;
    };
  }, [mockupSrc, logoSrc, zone]);

  return (
    <Card className="overflow-hidden border-border/60">
      <div className="relative aspect-[4/5] w-full bg-muted/40">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full object-contain"
        />
        <div className="pointer-events-none absolute left-3 top-3">
          <Badge variant="secondary" className="text-xs">
            {ZONE_LABEL[zone.name] ?? zone.name}
          </Badge>
        </div>
        {!logoSrc && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <Badge variant="outline" className="bg-background/90 text-xs">
              Upload a logo to see the preview
            </Badge>
          </div>
        )}
      </div>
    </Card>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

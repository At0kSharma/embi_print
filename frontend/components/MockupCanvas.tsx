"use client";

import { useEffect, useRef } from "react";
import type { PlacementZone } from "@/lib/types";

interface Props {
  mockupSrc: string;
  logoSrc: string | null;
  zone: PlacementZone;
}

/**
 * Draws the garment mockup with the uploaded logo overlaid at the zone's
 * percentage coordinates. No backend round-trips — pure client work.
 *
 * Both images are loaded fresh on every change. For mockup PNGs (a few
 * KB each) this is fine; in v2 we'd cache the loaded HTMLImageElement.
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

      // Match canvas internal size to the mockup so percentages map
      // 1:1 to pixels here. CSS layout still scales the canvas down.
      canvas.width = mockup.naturalWidth;
      canvas.height = mockup.naturalHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(mockup, 0, 0);

      if (!logoSrc) return;
      let logo: HTMLImageElement;
      try {
        logo = await loadImage(logoSrc);
      } catch {
        return; // logo URL not yet resolvable; skip overlay
      }
      if (cancelled) return;

      const x = zone.position_on_mockup.x_pct * canvas.width;
      const y = zone.position_on_mockup.y_pct * canvas.height;
      const w = zone.position_on_mockup.w_pct * canvas.width;
      const h = zone.position_on_mockup.h_pct * canvas.height;

      // Preserve logo aspect ratio inside the zone box.
      const logoRatio = logo.naturalWidth / logo.naturalHeight;
      const zoneRatio = w / h;
      let drawW = w;
      let drawH = h;
      if (logoRatio > zoneRatio) {
        drawH = w / logoRatio;
      } else {
        drawW = h * logoRatio;
      }
      const drawX = x + (w - drawW) / 2;
      const drawY = y + (h - drawH) / 2;

      ctx.drawImage(logo, drawX, drawY, drawW, drawH);
    };

    draw();
    return () => {
      cancelled = true;
    };
  }, [mockupSrc, logoSrc, zone]);

  return (
    <canvas
      ref={canvasRef}
      className="h-auto w-full max-w-full rounded border border-neutral-200 bg-white"
    />
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

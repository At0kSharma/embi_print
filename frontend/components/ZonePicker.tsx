"use client";

import type { PlacementZone } from "@/lib/types";
import { formatUSD } from "@/lib/pricing";

const ZONE_LABELS: Record<PlacementZone["name"], string> = {
  left_chest: "Left Chest",
  center_chest: "Center Chest",
  right_chest: "Right Chest",
  full_back: "Full Back",
};

interface Props {
  zones: PlacementZone[];
  selectedZoneId: string;
  onSelect: (zoneId: string) => void;
}

export function ZonePicker({ zones, selectedZoneId, onSelect }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-neutral-700">Placement</p>
      <div className="grid grid-cols-2 gap-2">
        {zones.map((z) => (
          <button
            key={z.id}
            type="button"
            onClick={() => onSelect(z.id)}
            className={`rounded border px-3 py-2 text-left text-sm transition ${
              z.id === selectedZoneId
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 bg-white hover:border-neutral-500"
            }`}
          >
            <div className="font-medium">{ZONE_LABELS[z.name] ?? z.name}</div>
            <div
              className={`text-xs ${
                z.id === selectedZoneId ? "text-neutral-300" : "text-neutral-500"
              }`}
            >
              +{formatUSD(z.add_on_price)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

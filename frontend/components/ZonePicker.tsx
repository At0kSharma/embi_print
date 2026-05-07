"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatUSD } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { PlacementZone } from "@/lib/types";

const ZONE_LABEL: Record<string, string> = {
  left_chest: "Left chest",
  center_chest: "Center chest",
  right_chest: "Right chest",
  full_back: "Full back",
  front: "Front",
  back: "Back",
  hood: "Hood",
};

const ZONE_DESCRIPTION: Record<string, string> = {
  left_chest: "Heart side · classic crest",
  center_chest: "Front and centered",
  right_chest: "Off-heart accent",
  full_back: "Statement piece",
  front: "Large front canvas",
  back: "Full-back artwork",
  hood: "Centered on the hood crown",
};

interface Props {
  zones: PlacementZone[];
  selectedZoneId: string;
  onSelect: (zoneId: string) => void;
}

export function ZonePicker({ zones, selectedZoneId, onSelect }: Props) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Placement</Label>
      <RadioGroup
        value={selectedZoneId}
        onValueChange={onSelect}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {zones.map((z) => {
          const isSelected = z.id === selectedZoneId;
          return (
            <Label
              key={z.id}
              htmlFor={`zone-${z.id}`}
              className={cn(
                "relative flex cursor-pointer items-start justify-between gap-3 rounded-md border bg-card p-3 transition-all",
                isSelected
                  ? "border-foreground ring-1 ring-foreground"
                  : "border-border hover:border-foreground/40",
              )}
            >
              <RadioGroupItem
                id={`zone-${z.id}`}
                value={z.id}
                className="mt-0.5 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium leading-tight">
                  {ZONE_LABEL[z.name] ?? z.name}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {ZONE_DESCRIPTION[z.name] ?? ""}
                </div>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                +{formatUSD(z.add_on_price)}
              </span>
            </Label>
          );
        })}
      </RadioGroup>
    </div>
  );
}

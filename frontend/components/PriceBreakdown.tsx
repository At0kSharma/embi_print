import { Separator } from "@/components/ui/separator";
import { formatUSD, type PriceBreakdown as Breakdown } from "@/lib/pricing";

export function PriceBreakdown({
  breakdown,
  quantity,
}: {
  breakdown: Breakdown;
  quantity: number;
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-4">
      <dl className="space-y-2 text-sm">
        <Row label="Garment" value={formatUSD(breakdown.base)} />
        {breakdown.variantDelta !== 0 && (
          <Row label="Variant" value={formatUSD(breakdown.variantDelta)} />
        )}
        <Row label="Embroidery" value={`+ ${formatUSD(breakdown.zoneAddOn)}`} />
        {quantity > 1 && <Row label="Quantity" value={`× ${quantity}`} />}
      </dl>

      <Separator className="my-3" />

      <div className="flex items-baseline justify-between text-base">
        <dt className="font-semibold">Total</dt>
        <dd className="text-lg font-semibold tabular-nums">
          {formatUSD(breakdown.total)}
        </dd>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

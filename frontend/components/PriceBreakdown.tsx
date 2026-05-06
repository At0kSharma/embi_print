import { formatUSD, type PriceBreakdown as Breakdown } from "@/lib/pricing";

export function PriceBreakdown({
  breakdown,
  quantity,
}: {
  breakdown: Breakdown;
  quantity: number;
}) {
  return (
    <dl className="space-y-1 rounded border border-neutral-200 bg-neutral-50 p-4 text-sm">
      <Row label="Base price" value={formatUSD(breakdown.base)} />
      {breakdown.variantDelta !== 0 && (
        <Row label="Variant" value={formatUSD(breakdown.variantDelta)} />
      )}
      <Row label="Placement" value={`+${formatUSD(breakdown.zoneAddOn)}`} />
      {quantity > 1 && (
        <Row label="Quantity" value={`× ${quantity}`} />
      )}
      <div className="my-1 border-t border-neutral-300" />
      <Row
        label="Total"
        value={formatUSD(breakdown.total)}
        emphasize
      />
    </dl>
  );
}

function Row({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <dt className={emphasize ? "font-semibold" : "text-neutral-600"}>{label}</dt>
      <dd className={emphasize ? "font-semibold" : ""}>{value}</dd>
    </div>
  );
}

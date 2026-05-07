import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { adminApi, type AdminOrder } from "@/lib/admin-api";
import { formatUSD } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, "secondary" | "default" | "outline"> = {
  pending: "outline",
  paid: "secondary",
  submitted_to_printful: "secondary",
  shipped: "default",
  delivered: "default",
};

export default async function AdminOrdersPage() {
  let orders: AdminOrder[];
  let error: string | null = null;
  try {
    orders = await adminApi.listOrders();
  } catch (e) {
    orders = [];
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="container max-w-6xl py-8 md:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground">
          {orders.length} {orders.length === 1 ? "order" : "orders"}, most recent first
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {orders.length === 0 && !error ? (
        <div className="rounded-md border border-dashed bg-background p-10 text-center text-sm text-muted-foreground">
          No orders yet.
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Order</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-left">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <code className="text-xs">{o.id.slice(0, 8)}</code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{o.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{o.customer_email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_COLORS[o.status] ?? "outline"} className="capitalize">
                        {o.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{o.item_count}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatUSD(o.total_price)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {o.created_at ? new Date(o.created_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

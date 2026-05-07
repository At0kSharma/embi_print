import { ChevronLeft } from "lucide-react";

import { OrderStatusView } from "./OrderStatusView";

export default function OrderConfirmationPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="container flex h-14 max-w-6xl items-center justify-between">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            All products
          </a>
          <a href="/" className="flex items-center gap-2 text-sm font-semibold">
            <span className="inline-block h-4 w-4 rounded-sm bg-primary" />
            embi_print
          </a>
        </div>
      </header>

      <main className="container max-w-2xl py-12 md:py-16">
        <OrderStatusView orderId={params.id} />
      </main>
    </div>
  );
}

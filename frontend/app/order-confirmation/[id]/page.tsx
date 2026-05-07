import { SiteHeader } from "@/components/SiteHeader";
import { OrderStatusView } from "./OrderStatusView";

export default function OrderConfirmationPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="min-h-svh">
      <SiteHeader back={{ href: "/", label: "All products" }} />
      <main className="container max-w-2xl py-12 md:py-16">
        <OrderStatusView orderId={params.id} />
      </main>
    </div>
  );
}

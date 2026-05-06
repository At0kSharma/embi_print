import { OrderStatusView } from "./OrderStatusView";

export default function OrderConfirmationPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <a href="/" className="text-sm text-neutral-500 hover:underline">
        ← All products
      </a>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Order confirmed</h1>
      <p className="mt-1 text-neutral-600">
        We&apos;re working on it. This page updates as your order moves through
        the pipeline.
      </p>
      <OrderStatusView orderId={params.id} />
    </main>
  );
}

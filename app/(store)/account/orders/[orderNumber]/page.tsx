import { CustomerOrderDetail } from "@/components/customer-order-detail";

export default async function CustomerOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  return <CustomerOrderDetail orderNumber={decodeURIComponent(orderNumber)} />;
}

import { CustomerOrdersView } from "@/components/customer-orders-view";

export default async function CustomerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  return <CustomerOrdersView documentFocus={params.view === "documents"} />;
}

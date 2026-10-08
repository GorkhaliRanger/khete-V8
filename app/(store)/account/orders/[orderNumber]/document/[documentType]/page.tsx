import { OrderDocumentView } from "@/components/order-document-view";

export default async function CustomerOrderDocumentPage({
  params,
}: {
  params: Promise<{ orderNumber: string; documentType: string }>;
}) {
  const { orderNumber, documentType } = await params;
  return (
    <OrderDocumentView
      orderNumber={decodeURIComponent(orderNumber)}
      documentType={decodeURIComponent(documentType)}
    />
  );
}

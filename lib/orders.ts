export type OrderStatus =
  | "pending_payment"
  | "payment_review"
  | "confirmed"
  | "processing"
  | "ready_for_dispatch"
  | "dispatched"
  | "delivered"
  | "cancelled"
  | "returned"
  | "refunded";

export type PaymentStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "failed"
  | "partially_refunded"
  | "refunded";

export type OrderRow = {
  id: string;
  order_number: string;
  customer_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string;
  currency: "NPR";
  subtotal: number | string;
  delivery_fee: number | string;
  discount_total: number | string;
  total: number | string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  district: string;
  municipality: string;
  ward: string;
  area: string;
  street_address: string;
  delivery_note: string | null;
  tracking_reference: string | null;
  estimated_delivery_date: string | null;
  placed_at: string;
  delivered_at: string | null;
  cancelled_at: string | null;
  return_window_ends_at: string | null;
  customer_delivery_confirmed_at: string | null;
  customer_delivery_note: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  listing_id: string | null;
  variant_id: string | null;
  listing_name: string;
  variant_name: string | null;
  sku: string | null;
  unit_label: string | null;
  unit_price: number | string;
  quantity: number | string;
  line_total: number | string;
};

export type OrderWithItems = OrderRow & { items: OrderItemRow[] };

export type OrderHistoryRow = {
  id: string;
  order_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  note: string | null;
  changed_by: string | null;
  created_at: string;
};

export const orderDocumentTypes = [
  "order_confirmation",
  "payment_invoice",
  "tax_invoice",
] as const;

export type OrderDocumentType = (typeof orderDocumentTypes)[number];
export type OrderDocumentStatus = "issued" | "void";

export type OrderDocumentRow = {
  id: string;
  order_id: string;
  document_type: OrderDocumentType;
  document_number: string;
  status: OrderDocumentStatus;
  currency: "NPR";
  subtotal: number | string;
  delivery_fee: number | string;
  discount_total: number | string;
  total: number | string;
  issuer_legal_name: string | null;
  issuer_pan_vat: string | null;
  issuer_address: string | null;
  issuer_email: string | null;
  issuer_phone: string | null;
  note: string | null;
  issued_at: string;
  created_at: string;
  updated_at: string;
};

export const orderStatuses: OrderStatus[] = [
  "pending_payment",
  "payment_review",
  "confirmed",
  "processing",
  "ready_for_dispatch",
  "dispatched",
  "delivered",
  "cancelled",
  "returned",
  "refunded",
];

export const paymentStatuses: PaymentStatus[] = [
  "unpaid",
  "pending",
  "paid",
  "failed",
  "partially_refunded",
  "refunded",
];

export const orderSelect = "id,order_number,customer_id,status,payment_status,payment_method,currency,subtotal,delivery_fee,discount_total,total,customer_name,customer_email,customer_phone,district,municipality,ward,area,street_address,delivery_note,tracking_reference,estimated_delivery_date,placed_at,delivered_at,cancelled_at,return_window_ends_at,customer_delivery_confirmed_at,customer_delivery_note,created_at,updated_at";
export const orderItemSelect = "id,order_id,listing_id,variant_id,listing_name,variant_name,sku,unit_label,unit_price,quantity,line_total";
export const orderHistorySelect = "id,order_id,status,payment_status,note,changed_by,created_at";
export const orderDocumentSelect = "id,order_id,document_type,document_number,status,currency,subtotal,delivery_fee,discount_total,total,issuer_legal_name,issuer_pan_vat,issuer_address,issuer_email,issuer_phone,note,issued_at,created_at,updated_at";

export function labelOrderStatus(status: OrderStatus) {
  return status.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

/* Orders that have not been processed at all: received, but not yet moving through fulfilment. */
export const pendingOrderStatuses: OrderStatus[] = ["pending_payment", "payment_review", "confirmed"];

/* How long a pending order may sit unprocessed before it is flagged overdue. */
export const pendingOrderOverdueMs = 24 * 60 * 60 * 1000;

export function isPendingOrder(status: OrderStatus) {
  return pendingOrderStatuses.includes(status);
}

export function isOverduePendingOrder(placedAt: string, now = Date.now()) {
  return now - new Date(placedAt).getTime() > pendingOrderOverdueMs;
}

export function labelPaymentStatus(status: PaymentStatus) {
  return status.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

const documentLabels: Record<OrderDocumentType, string> = {
  order_confirmation: "Order confirmation",
  payment_invoice: "Payment invoice",
  tax_invoice: "Tax invoice",
};

export function labelOrderDocumentType(type: OrderDocumentType) {
  return documentLabels[type];
}

export function formatOrderDate(value: string) {
  return new Intl.DateTimeFormat("en-NP", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatOrderDay(value: string) {
  return new Intl.DateTimeFormat("en-NP", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

export function orderError(value: unknown) {
  const message = value instanceof Error
    ? value.message
    : value && typeof value === "object" && "message" in value && typeof value.message === "string"
      ? value.message
      : "The order could not be loaded.";
  const normalized = message.toLowerCase();
  if (
    normalized.includes("relation")
    || normalized.includes("schema cache")
    || normalized.includes("order_document")
    || normalized.includes("return_window_ends_at")
  ) {
    return "Run the latest Order Tracking & Documents migration in Supabase, then refresh this page.";
  }
  return message;
}

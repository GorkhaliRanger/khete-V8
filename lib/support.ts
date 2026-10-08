export const supportTicketTypes = [
  "general_enquiry",
  "product_question",
  "order_issue",
  "delivery_issue",
  "return_request",
  "payment_issue",
  "custom_request",
  "seller_application",
  "account_issue",
  "other",
] as const;

export const supportTicketStatuses = [
  "open",
  "in_progress",
  "awaiting_customer",
  "resolved",
  "closed",
] as const;

export const supportPriorities = ["normal", "high", "urgent"] as const;

export type SupportTicketType = (typeof supportTicketTypes)[number];
export type SupportTicketStatus = (typeof supportTicketStatuses)[number];
export type SupportPriority = (typeof supportPriorities)[number];

export type SupportTicketRow = {
  id: string;
  ticket_number: string;
  customer_id: string | null;
  type: SupportTicketType;
  status: SupportTicketStatus;
  priority: SupportPriority;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  subject: string;
  order_number: string | null;
  assigned_to: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
};

export type SupportMessageRow = {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  sender_kind: "guest" | "customer" | "team";
  body: string;
  is_internal: boolean;
  created_at: string;
};

export type SupportAttachmentRow = {
  id: string;
  ticket_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
};

export const supportTicketSelect = "id,ticket_number,customer_id,type,status,priority,contact_name,contact_email,contact_phone,subject,order_number,assigned_to,last_message_at,created_at,updated_at";
export const supportMessageSelect = "id,ticket_id,sender_id,sender_kind,body,is_internal,created_at";
export const supportAttachmentSelect = "id,ticket_id,file_name,storage_path,mime_type,size_bytes,uploaded_by,created_at";

export const supportTypesRequiringReference = new Set<SupportTicketType>([
  "order_issue",
  "delivery_issue",
  "return_request",
  "payment_issue",
  "custom_request",
]);

export const supportTopicOptions: {
  value: SupportTicketType;
  title: string;
  description: string;
}[] = [
  {
    value: "general_enquiry",
    title: "General question",
    description: "Ask about khetE, the marketplace, products, or services.",
  },
  {
    value: "product_question",
    title: "Product support",
    description: "Questions about a product, service, equipment item, or availability.",
  },
  {
    value: "order_issue",
    title: "Order support",
    description: "Help with an existing or previous order request.",
  },
  {
    value: "delivery_issue",
    title: "Delivery support",
    description: "Tracking, delays, delivery addresses, or service areas.",
  },
  {
    value: "return_request",
    title: "Cancellation, return or replacement",
    description: "Report an incorrect, damaged, unsuitable, or cancelled order.",
  },
  {
    value: "payment_issue",
    title: "Payment support",
    description: "Questions about charges, payment status, or payment methods.",
  },
  {
    value: "custom_request",
    title: "Custom request or quotation",
    description: "Ask about a special product, quantity, service, or quotation.",
  },
  {
    value: "seller_application",
    title: "Farmer, business or partner support",
    description: "Applications, verification, onboarding, and account guidance.",
  },
  {
    value: "account_issue",
    title: "Account support",
    description: "Login, profile, saved items, and customer-account help.",
  },
  {
    value: "other",
    title: "Something else",
    description: "Choose this when none of the listed topics fits your request.",
  },
];

const typeLabels: Record<SupportTicketType, string> = {
  general_enquiry: "General enquiry",
  product_question: "Product question",
  order_issue: "Order issue",
  delivery_issue: "Delivery issue",
  return_request: "Cancellation, return or replacement",
  payment_issue: "Payment issue",
  custom_request: "Custom request or quotation",
  seller_application: "Farmer, business or partner support",
  account_issue: "Account issue",
  other: "Other",
};

const statusLabels: Record<SupportTicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  awaiting_customer: "Awaiting customer",
  resolved: "Resolved",
  closed: "Closed",
};

export function labelSupportType(value: SupportTicketType) {
  return typeLabels[value];
}

export function labelSupportStatus(value: SupportTicketStatus) {
  return statusLabels[value];
}

export function formatSupportDate(value: string) {
  return new Intl.DateTimeFormat("en-NP", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatSupportFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function supportError(value: unknown) {
  const message = value instanceof Error
    ? value.message
    : value && typeof value === "object" && "message" in value && typeof value.message === "string"
      ? value.message
      : "The support request could not be completed.";
  const normalized = message.toLowerCase();
  if (normalized.includes("relation") || normalized.includes("schema cache") || normalized.includes("support_ticket")) {
    return "Run the latest Customer Support migrations in Supabase, then refresh this page.";
  }
  return message;
}

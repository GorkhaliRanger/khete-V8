import type { ProfessionalRole } from "./professional-network";

export type ProfessionalOfferingKind =
  | "advisory_service"
  | "expert_service"
  | "partner_product"
  | "partner_service";
export type ProfessionalOfferingStatus = "active" | "hidden" | "archived";
export type ProfessionalActivityStatus =
  | "booked"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "refunded";
export type ProfessionalEarningStatus =
  | "pending"
  | "available"
  | "scheduled"
  | "paid"
  | "withheld"
  | "reversed";

export type ProfessionalAccountProfile = {
  id: string;
  slug: string;
  role: ProfessionalRole;
  name: string;
  position_title: string;
  organization_name: string | null;
  profile_image_url: string | null;
  status: "draft" | "active" | "hidden" | "suspended";
  account_linked: boolean;
};

export type ProfessionalOffering = {
  id: string;
  profile_id: string;
  kind: ProfessionalOfferingKind;
  title: string;
  description: string | null;
  price: number;
  unit_label: string;
  status: ProfessionalOfferingStatus;
  created_at: string;
  updated_at: string;
};

export type ProfessionalEarning = {
  id: string;
  earning_number: string;
  profile_id: string;
  offering_id: string | null;
  reference_number: string | null;
  activity_kind: ProfessionalOfferingKind;
  title: string;
  quantity: number;
  unit_price: number;
  gross_amount: number;
  discount_amount: number;
  platform_commission: number;
  payment_fee: number;
  shipping_deduction: number;
  other_deduction: number;
  net_amount: number;
  activity_status: ProfessionalActivityStatus;
  earning_status: ProfessionalEarningStatus;
  activity_date: string;
  completed_at: string | null;
  payout_reference: string | null;
  paid_at: string | null;
  internal_note: string | null;
  created_at: string;
  updated_at: string;
};

export const professionalAccountProfileSelect =
  "id,slug,role,name,position_title,organization_name,profile_image_url,status";
export const professionalOfferingSelect =
  "id,profile_id,kind,title,description,price,unit_label,status,created_at,updated_at";
export const professionalEarningSelect =
  "id,earning_number,profile_id,offering_id,reference_number,activity_kind,title,quantity,unit_price,gross_amount,discount_amount,platform_commission,payment_fee,shipping_deduction,other_deduction,net_amount,activity_status,earning_status,activity_date,completed_at,payout_reference,paid_at,internal_note,created_at,updated_at";

export const professionalOfferingKinds: ProfessionalOfferingKind[] = [
  "advisory_service",
  "expert_service",
  "partner_product",
  "partner_service",
];
export const professionalOfferingStatuses: ProfessionalOfferingStatus[] = [
  "active",
  "hidden",
  "archived",
];
export const professionalActivityStatuses: ProfessionalActivityStatus[] = [
  "booked",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "refunded",
];
export const professionalEarningStatuses: ProfessionalEarningStatus[] = [
  "pending",
  "available",
  "scheduled",
  "paid",
  "withheld",
  "reversed",
];

export function labelProfessionalOfferingKind(kind: ProfessionalOfferingKind) {
  return {
    advisory_service: "Advisory service",
    expert_service: "Expert service",
    partner_product: "Partner product",
    partner_service: "Partner service",
  }[kind];
}

export function labelProfessionalOfferingStatus(status: ProfessionalOfferingStatus) {
  return {
    active: "Active",
    hidden: "Hidden",
    archived: "Archived",
  }[status];
}

export function labelProfessionalActivityStatus(status: ProfessionalActivityStatus) {
  return {
    booked: "Booked",
    confirmed: "Confirmed",
    in_progress: "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
    refunded: "Refunded",
  }[status];
}

export function labelProfessionalEarningStatus(status: ProfessionalEarningStatus) {
  return {
    pending: "Pending",
    available: "Available",
    scheduled: "Payout scheduled",
    paid: "Paid",
    withheld: "On hold",
    reversed: "Reversed",
  }[status];
}

export function allowedOfferingKinds(role: ProfessionalRole): ProfessionalOfferingKind[] {
  if (role === "advisor") return ["advisory_service"];
  if (role === "expert_professional") return ["expert_service"];
  return ["partner_product", "partner_service"];
}

export function defaultOfferingKind(role: ProfessionalRole): ProfessionalOfferingKind {
  return allowedOfferingKinds(role)[0];
}

export function professionalFinanceError(value: unknown) {
  const message =
    value instanceof Error
      ? value.message
      : value && typeof value === "object" && "message" in value
        ? String(value.message)
        : "The Professional Account request could not be completed.";
  if (message.includes("professional_earnings") || message.includes("professional_offerings")) {
    return "Run the Professional Accounts migration in Supabase before opening this dashboard.";
  }
  return message;
}

export function professionalDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-NP", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value.includes("T") ? value : `${value}T00:00:00`));
}

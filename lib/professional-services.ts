import type { ProfessionalOfferingKind } from "./professional-finance";
import type { ProfessionalRole } from "./professional-network";

export type ProfessionalServiceRequestStatus =
  | "submitted"
  | "accepted"
  | "reschedule_requested"
  | "in_progress"
  | "completed"
  | "declined"
  | "cancelled";

export type ProfessionalServiceProvider = {
  id: string;
  slug: string;
  role: ProfessionalRole;
  name: string;
  position_title: string;
  organization_name: string | null;
  location: string;
  profile_image_url: string | null;
  status?: "draft" | "active" | "hidden" | "suspended";
};

export type ProfessionalServiceOfferingSummary = {
  id: string;
  profile_id: string;
  kind: ProfessionalOfferingKind;
  title: string;
  description: string | null;
  price: number;
  unit_label: string;
  status: "active" | "hidden" | "archived";
  created_at: string;
  updated_at: string;
  professional_profiles: ProfessionalServiceProvider;
};

export type ProfessionalServiceRequest = {
  id: string;
  request_number: string;
  customer_id: string;
  profile_id: string;
  offering_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_location: string;
  preferred_date: string;
  preferred_time_slot: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  customer_note: string | null;
  professional_note: string | null;
  status: ProfessionalServiceRequestStatus;
  submitted_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  professional_profiles: Omit<ProfessionalServiceProvider, "location" | "status">;
  professional_offerings: {
    id: string;
    kind: ProfessionalOfferingKind;
    title: string;
    unit_label: string;
  };
};

export const professionalServiceOfferingSelect =
  "id,profile_id,kind,title,description,price,unit_label,status,created_at,updated_at,professional_profiles!inner(id,slug,role,name,position_title,organization_name,location,profile_image_url,status)";

export const professionalServiceRequestSelect =
  "id,request_number,customer_id,profile_id,offering_id,customer_name,customer_email,customer_phone,service_location,preferred_date,preferred_time_slot,quantity,unit_price,total_amount,customer_note,professional_note,status,submitted_at,accepted_at,started_at,completed_at,cancelled_at,created_at,updated_at,professional_profiles(id,slug,role,name,position_title,organization_name,profile_image_url),professional_offerings(id,kind,title,unit_label)";

export const professionalServiceRequestStatuses: ProfessionalServiceRequestStatus[] = [
  "submitted",
  "accepted",
  "reschedule_requested",
  "in_progress",
  "completed",
  "declined",
  "cancelled",
];

export function labelProfessionalServiceRequestStatus(
  status: ProfessionalServiceRequestStatus,
) {
  return {
    submitted: "Request submitted",
    accepted: "Accepted",
    reschedule_requested: "Schedule change requested",
    in_progress: "In progress",
    completed: "Completed",
    declined: "Declined",
    cancelled: "Cancelled",
  }[status];
}

export function professionalServiceDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-NP", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value.includes("T") ? value : `${value}T00:00:00`));
}

export function professionalServiceError(value: unknown) {
  const message =
    value instanceof Error
      ? value.message
      : value && typeof value === "object" && "message" in value
        ? String(value.message)
        : "The service request could not be completed.";

  if (
    message.includes("professional_service_requests") ||
    message.includes("create_professional_service_request")
  ) {
    return "Run the Professional Services & Booking migration in Supabase to activate service requests.";
  }
  return message;
}

export function professionalRequestActions(status: ProfessionalServiceRequestStatus) {
  if (status === "submitted") {
    return ["accepted", "reschedule_requested", "declined"] as const;
  }
  if (status === "accepted") {
    return ["in_progress", "reschedule_requested", "cancelled"] as const;
  }
  if (status === "reschedule_requested") {
    return ["accepted", "declined"] as const;
  }
  if (status === "in_progress") {
    return ["completed"] as const;
  }
  return [] as const;
}

export type ProfessionalRole = "advisor" | "expert_professional" | "associate_partner";
export type ProfessionalApplicationStatus =
  | "submitted"
  | "under_review"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "withdrawn";
export type ProfessionalProfileStatus = "draft" | "active" | "hidden" | "suspended";
export type ProfessionalTone = "forest" | "gold" | "sage" | "earth";

export type ProfessionalProfile = {
  id: string;
  source_application_id: string | null;
  slug: string;
  role: ProfessionalRole;
  name: string;
  position_title: string;
  organization_name: string | null;
  location: string;
  experience: string;
  expertise: string[];
  summary: string;
  biography: string[];
  achievements: string[];
  qualifications: string[];
  website_url: string | null;
  profile_image_url: string | null;
  tone: ProfessionalTone;
  status: ProfessionalProfileStatus;
  featured: boolean;
  sort_order: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfessionalApplication = {
  id: string;
  application_number: string;
  applicant_id: string | null;
  role: ProfessionalRole;
  applicant_name: string;
  organization_name: string | null;
  position_title: string;
  contact_email: string;
  contact_phone: string | null;
  location: string;
  experience: string;
  expertise: string[];
  qualifications: string[];
  summary: string;
  motivation: string;
  website_url: string | null;
  status: ProfessionalApplicationStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export const professionalProfileSelect =
  "id,source_application_id,slug,role,name,position_title,organization_name,location,experience,expertise,summary,biography,achievements,qualifications,website_url,profile_image_url,tone,status,featured,sort_order,published_at,created_at,updated_at";

export const professionalApplicationSelect =
  "id,application_number,applicant_id,role,applicant_name,organization_name,position_title,contact_email,contact_phone,location,experience,expertise,qualifications,summary,motivation,website_url,status,admin_notes,reviewed_by,reviewed_at,created_at,updated_at";

export const professionalRoles: ProfessionalRole[] = [
  "advisor",
  "expert_professional",
  "associate_partner",
];

export const professionalApplicationStatuses: ProfessionalApplicationStatus[] = [
  "submitted",
  "under_review",
  "changes_requested",
  "approved",
  "rejected",
  "withdrawn",
];

export const professionalProfileStatuses: ProfessionalProfileStatus[] = [
  "draft",
  "active",
  "hidden",
  "suspended",
];

export const professionalTones: ProfessionalTone[] = ["forest", "gold", "sage", "earth"];

export function labelProfessionalRole(role: ProfessionalRole) {
  return {
    advisor: "Advisor",
    expert_professional: "Expert Professional",
    associate_partner: "Associate Partner",
  }[role];
}

export function pluralProfessionalRole(role: ProfessionalRole) {
  return {
    advisor: "Advisors",
    expert_professional: "Expert Professionals",
    associate_partner: "Associate Partners",
  }[role];
}

export function labelProfessionalApplicationStatus(status: ProfessionalApplicationStatus) {
  return {
    submitted: "Submitted",
    under_review: "Under review",
    changes_requested: "Changes requested",
    approved: "Approved",
    rejected: "Not approved",
    withdrawn: "Withdrawn",
  }[status];
}

export function labelProfessionalProfileStatus(status: ProfessionalProfileStatus) {
  return {
    draft: "Draft",
    active: "Active",
    hidden: "Hidden",
    suspended: "Suspended",
  }[status];
}

export function professionalError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "The professional-network request could not be completed.";
}

export function splitProfessionalList(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function professionalInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

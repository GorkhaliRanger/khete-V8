import type { ListingType } from "@/data/marketplace";
import type { ProfessionalOfferingKind } from "@/lib/professional-finance";
import type { ProfessionalRole } from "@/lib/professional-network";

export type CertificateStatus = "draft" | "verified" | "expired" | "revoked" | "archived";
export type CertificateSubjectKind = "person" | "farm";
export type CertificateTargetType = "profile" | "listing" | "offering" | "subject";

export type Certificate = {
  id: string;
  slug: string;
  title: string;
  certificate_type: string;
  issuer: string;
  certificate_number: string;
  summary: string;
  full_text: string | null;
  issued_on: string | null;
  valid_from: string | null;
  expires_on: string | null;
  status: CertificateStatus;
  verification_url: string | null;
  document_url: string | null;
  document_storage_path: string | null;
  document_mime_type: string | null;
  is_public: boolean;
  verified_by: string | null;
  verified_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CertificateSubject = {
  id: string;
  kind: CertificateSubjectKind;
  slug: string;
  display_name: string;
  subtitle: string | null;
  location: string | null;
  description: string | null;
  image_url: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type CertificateLink = {
  id: string;
  certificate_id: string;
  professional_profile_id: string | null;
  listing_id: string | null;
  professional_offering_id: string | null;
  subject_id: string | null;
  created_at: string;
};

export type CertificateProfileTarget = {
  id: string;
  slug: string;
  role: ProfessionalRole;
  name: string;
  position_title: string;
  organization_name: string | null;
  status?: string;
};

export type CertificateListingTarget = {
  id: string;
  slug: string;
  kind: ListingType;
  name_en: string;
  status?: string;
};

export type CertificateOfferingTarget = {
  id: string;
  profile_id: string;
  kind: ProfessionalOfferingKind;
  title: string;
  status?: string;
  professional_profiles?: {
    id: string;
    slug: string;
    name: string;
  } | null;
};

export const certificateSelect = [
  "id",
  "slug",
  "title",
  "certificate_type",
  "issuer",
  "certificate_number",
  "summary",
  "full_text",
  "issued_on",
  "valid_from",
  "expires_on",
  "status",
  "verification_url",
  "document_url",
  "document_storage_path",
  "document_mime_type",
  "is_public",
  "verified_by",
  "verified_at",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
].join(",");

export const certificateSubjectSelect =
  "id,kind,slug,display_name,subtitle,location,description,image_url,is_public,created_at,updated_at";

export const certificateLinkSelect =
  "id,certificate_id,professional_profile_id,listing_id,professional_offering_id,subject_id,created_at";

export const certificateStatuses: CertificateStatus[] = [
  "draft",
  "verified",
  "expired",
  "revoked",
  "archived",
];

export const certificateTypes = [
  "organic",
  "quality",
  "registration",
  "training",
  "safety",
  "compliance",
  "inspection",
  "laboratory",
  "other",
] as const;

export function labelCertificateStatus(status: CertificateStatus, expiresOn?: string | null) {
  if (status === "verified" && expiresOn && new Date(`${expiresOn}T23:59:59`).getTime() < Date.now()) {
    return "Expired";
  }
  return {
    draft: "Draft",
    verified: "Verified",
    expired: "Expired",
    revoked: "Revoked",
    archived: "Archived",
  }[status];
}

export function publicCertificateStatus(certificate: Pick<Certificate, "status" | "expires_on">) {
  if (
    certificate.status === "expired"
    || (
      certificate.status === "verified"
      && certificate.expires_on
      && new Date(`${certificate.expires_on}T23:59:59`).getTime() < Date.now()
    )
  ) return "expired";
  return certificate.status;
}

export function labelCertificateType(type: string) {
  return type
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function certificateDate(value: string | null | undefined) {
  if (!value) return "Not specified";
  return new Intl.DateTimeFormat("en-NP", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value.includes("T") ? value : `${value}T00:00:00`));
}

export function certificateError(value: unknown) {
  const message =
    value instanceof Error
      ? value.message
      : value && typeof value === "object" && "message" in value
        ? String(value.message)
        : "The certificate request could not be completed.";
  if (
    (message.includes("relation") || message.includes("schema cache"))
    && (
      message.includes("certificates")
      || message.includes("certificate_links")
      || message.includes("certificate_subjects")
    )
  ) {
    return "Run the Certificates migration in Supabase to activate this feature.";
  }
  return message;
}

export function certificateSlug(value: string) {
  const base = value
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "certificate"}-${crypto.randomUUID().slice(0, 8)}`;
}

export function safeCertificateDocumentName(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const base = file.name
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "certificate";
  return `${base}-${crypto.randomUUID()}.${extension}`;
}

export function validateCertificateDocument(file: File) {
  const allowed = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(file.type)) {
    throw new Error("Use a PDF, JPG, PNG or WebP certificate document.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("The certificate document must be 10 MB or smaller.");
  }
}

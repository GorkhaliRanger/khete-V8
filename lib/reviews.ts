export type ReviewKind = "product" | "professional_service";
export type ReviewStatus = "pending" | "published" | "rejected" | "withdrawn";
export type ReviewSourceType = "order_item" | "service_request";
export type ReviewTargetType = "listing" | "professional";

export type MarketplaceReview = {
  id: string;
  customer_id: string;
  kind: ReviewKind;
  listing_id: string | null;
  variant_id: string | null;
  order_item_id: string | null;
  profile_id: string | null;
  offering_id: string | null;
  service_request_id: string | null;
  reviewer_name: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewOpportunity = {
  source_type: ReviewSourceType;
  source_id: string;
  target_type: ReviewTargetType;
  target_id: string;
  target_name: string;
  secondary_name: string | null;
  reference_number: string;
  completed_at: string | null;
  existing_review_id: string | null;
  existing_status: ReviewStatus | null;
  existing_rating: number | null;
  existing_title: string | null;
  existing_body: string | null;
  existing_admin_note: string | null;
};

export const marketplaceReviewSelect = [
  "id",
  "customer_id",
  "kind",
  "listing_id",
  "variant_id",
  "order_item_id",
  "profile_id",
  "offering_id",
  "service_request_id",
  "reviewer_name",
  "rating",
  "title",
  "body",
  "status",
  "admin_note",
  "reviewed_by",
  "reviewed_at",
  "published_at",
  "created_at",
  "updated_at",
].join(",");

export const reviewStatuses: ReviewStatus[] = [
  "pending",
  "published",
  "rejected",
  "withdrawn",
];

export function labelReviewStatus(status: ReviewStatus) {
  return {
    pending: "Pending review",
    published: "Published",
    rejected: "Changes required",
    withdrawn: "Withdrawn",
  }[status];
}

export function formatReviewDate(value: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-NP", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function reviewError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "The review request could not be completed.";
}

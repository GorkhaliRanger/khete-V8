export type PromotionTarget = "listing" | "category" | "deals";
export type PromotionTheme = "green" | "gold" | "sand" | "blue" | "plum";

export type PromotionRow = {
  id: string;
  title_en: string;
  title_ne: string | null;
  eyebrow_en: string | null;
  eyebrow_ne: string | null;
  description_en: string | null;
  description_ne: string | null;
  button_label_en: string;
  button_label_ne: string | null;
  target_type: PromotionTarget;
  target_listing_id: string | null;
  target_category_id: string | null;
  banner_storage_path: string | null;
  theme: PromotionTheme;
  show_on_homepage: boolean;
  show_on_deals_page: boolean;
  is_active: boolean;
  sort_order: number;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export const promotionSelect = [
  "id",
  "title_en",
  "title_ne",
  "eyebrow_en",
  "eyebrow_ne",
  "description_en",
  "description_ne",
  "button_label_en",
  "button_label_ne",
  "target_type",
  "target_listing_id",
  "target_category_id",
  "banner_storage_path",
  "theme",
  "show_on_homepage",
  "show_on_deals_page",
  "is_active",
  "sort_order",
  "starts_at",
  "ends_at",
  "created_at",
  "updated_at",
].join(",");

export function promotionState(row: Pick<PromotionRow, "is_active" | "starts_at" | "ends_at">, now = new Date()) {
  if (!row.is_active) return "hidden" as const;
  const start = new Date(row.starts_at);
  const end = row.ends_at ? new Date(row.ends_at) : null;
  if (start > now) return "scheduled" as const;
  if (end && end < now) return "ended" as const;
  return "live" as const;
}

export function isLivePromotion(row: Pick<PromotionRow, "is_active" | "starts_at" | "ends_at">, now = new Date()) {
  return promotionState(row, now) === "live";
}

export function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : null;
}

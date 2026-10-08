export const sitePolicyKeys = ["terms", "privacy", "returns", "delivery", "payment"] as const;

export type SitePolicyKey = (typeof sitePolicyKeys)[number];
export type SitePolicyStatus = "draft" | "published";

export type SitePolicyRow = {
  id: string;
  policy_key: SitePolicyKey;
  title_en: string;
  title_ne: string | null;
  summary_en: string | null;
  summary_ne: string | null;
  body_en: string;
  body_ne: string | null;
  status: SitePolicyStatus;
  version: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type SitePolicyRevisionRow = {
  id: string;
  document_id: string;
  version: number;
  title_en: string;
  title_ne: string | null;
  summary_en: string | null;
  summary_ne: string | null;
  body_en: string;
  body_ne: string | null;
  status: SitePolicyStatus;
  changed_at: string;
  changed_by: string | null;
};

export const sitePolicySelect = "id,policy_key,title_en,title_ne,summary_en,summary_ne,body_en,body_ne,status,version,published_at,created_at,updated_at,created_by,updated_by";
export const sitePolicyRevisionSelect = "id,document_id,version,title_en,title_ne,summary_en,summary_ne,body_en,body_ne,status,changed_at,changed_by";

export const sitePolicyLabels: Record<SitePolicyKey, { en: string; ne: string; short: string }> = {
  terms: { en: "Terms & Conditions", ne: "नियम तथा सर्तहरू", short: "Terms" },
  privacy: { en: "Privacy Policy", ne: "गोपनीयता नीति", short: "Privacy" },
  returns: { en: "Returns & Refunds", ne: "फिर्ता तथा रकम फिर्ता नीति", short: "Returns" },
  delivery: { en: "Delivery Policy", ne: "डेलिभरी नीति", short: "Delivery" },
  payment: { en: "Payment Policy", ne: "भुक्तानी नीति", short: "Payment" },
};

export function isSitePolicyKey(value: string): value is SitePolicyKey {
  return sitePolicyKeys.includes(value as SitePolicyKey);
}

export function formatPolicyDate(value: string | null, locale = "en-NP") {
  if (!value) return "Not published";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

export function sitePolicyError(value: unknown) {
  const message = value instanceof Error
    ? value.message
    : value && typeof value === "object" && "message" in value && typeof value.message === "string"
      ? value.message
      : "The policy content could not be loaded.";
  const normalized = message.toLowerCase();
  if (normalized.includes("relation") || normalized.includes("schema cache")) {
    return "Run migration 202607240013_site_policies.sql in Supabase, then refresh this page.";
  }
  if (normalized.includes("row-level security") || normalized.includes("permission denied")) {
    return "This account does not have permission to manage policy content.";
  }
  return message;
}

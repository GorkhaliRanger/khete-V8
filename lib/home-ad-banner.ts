export const HOME_AD_BANNER_KEY = "home_ad_banner";
export const HOME_AD_BANNER_BUCKET = "marketplace-media";

export type HomeAdBanner = {
  enabled: boolean;
  eyebrow: string;
  headline: string;
  body: string;
  buttonLabel: string;
  buttonHref: string;
  imagePath: string;
};

export const DEFAULT_HOME_AD_BANNER: HomeAdBanner = {
  enabled: true,
  eyebrow: "Shop with confidence",
  headline: "Delivery that fits",
  body: "khetE and courier fulfilment, with clear listing details and support after ordering.",
  buttonLabel: "Explore marketplace",
  buttonHref: "/products",
  imagePath: "",
};

const limits = { eyebrow: 50, headline: 90, body: 240, buttonLabel: 40 } as const;

function textField(value: unknown, fallback: string, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : fallback;
}

export function safeBannerHref(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_HOME_AD_BANNER.buttonHref;
  const href = value.trim();
  if (href.length > 300 || href.includes("\\") || /[\u0000-\u001f]/.test(href)) return DEFAULT_HOME_AD_BANNER.buttonHref;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    if (url.protocol === "https:" && url.hostname) return url.toString();
  } catch { /* Use the local marketplace when an editor enters an invalid link. */ }
  return DEFAULT_HOME_AD_BANNER.buttonHref;
}

export function safeBannerImagePath(value: unknown): string {
  if (typeof value !== "string") return "";
  const path = value.trim();
  if (!/^home-ad-banner\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)$/.test(path)) return "";
  return path;
}

export function parseHomeAdBanner(raw: unknown): HomeAdBanner {
  let value: unknown = raw;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return DEFAULT_HOME_AD_BANNER; }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_HOME_AD_BANNER;
  const data = value as Record<string, unknown>;
  return {
    enabled: typeof data.enabled === "boolean" ? data.enabled : DEFAULT_HOME_AD_BANNER.enabled,
    eyebrow: textField(data.eyebrow, DEFAULT_HOME_AD_BANNER.eyebrow, limits.eyebrow),
    headline: textField(data.headline, DEFAULT_HOME_AD_BANNER.headline, limits.headline),
    body: textField(data.body, DEFAULT_HOME_AD_BANNER.body, limits.body),
    buttonLabel: textField(data.buttonLabel, DEFAULT_HOME_AD_BANNER.buttonLabel, limits.buttonLabel),
    buttonHref: safeBannerHref(data.buttonHref),
    imagePath: safeBannerImagePath(data.imagePath),
  };
}

export function validateHomeAdBanner(value: HomeAdBanner): string | null {
  if (!value.headline.trim()) return "Add a banner headline.";
  if (!value.body.trim()) return "Add banner text.";
  const href = value.buttonHref.trim();
  if (value.buttonLabel.trim() && safeBannerHref(href) === DEFAULT_HOME_AD_BANNER.buttonHref && href !== DEFAULT_HOME_AD_BANNER.buttonHref) {
    return "The button link must be a local path beginning with / or a secure https:// address.";
  }
  return null;
}

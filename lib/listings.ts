import type { CategoryRow } from "@/lib/categories";
import type { Listing, ListingType, ListingVariant } from "@/data/marketplace";
import { calculateOfferPrice, type OfferType } from "@/lib/offers";

export type ListingStatus = "draft" | "active" | "inactive" | "archived";

export type ListingImageRow = {
  id: string;
  listing_id: string;
  storage_path: string;
  alt_text_en: string | null;
  alt_text_ne: string | null;
  sort_order: number;
  is_primary: boolean;
};

export type ListingVariantRow = {
  id: string;
  listing_id: string;
  name_en: string;
  name_ne: string | null;
  sku: string | null;
  price: number | string;
  compare_at_price: number | string | null;
  offer_title: string | null;
  offer_type: OfferType | null;
  offer_value: number | string | null;
  unit_label: string | null;
  stock_quantity: number | string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export const listingVariantSelect = "id,listing_id,name_en,name_ne,sku,price,compare_at_price,offer_title,offer_type,offer_value,unit_label,stock_quantity,is_active,sort_order,created_at,updated_at";

export const NEW_ARRIVAL_DAYS = 30;

function isNewArrivalDate(value: string | null | undefined) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  const age = Date.now() - timestamp;
  return age >= 0 && age <= NEW_ARRIVAL_DAYS * 24 * 60 * 60 * 1000;
}

export type ListingRow = {
  id: string;
  category_id: string;
  kind: ListingType;
  status: ListingStatus;
  slug: string;
  name_en: string;
  name_ne: string | null;
  short_description_en: string | null;
  short_description_ne: string | null;
  description_en: string | null;
  description_ne: string | null;
  specifications: unknown;
  search_keywords: string[] | null;
  sku: string | null;
  base_price: number | string | null;
  compare_at_price: number | string | null;
  offer_title: string | null;
  offer_type: OfferType | null;
  offer_value: number | string | null;
  price_label: string | null;
  unit_label: string | null;
  available: boolean;
  stock_managed: boolean;
  featured: boolean;
  districts: string[] | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export const listingSelect = [
  "id",
  "category_id",
  "kind",
  "status",
  "slug",
  "name_en",
  "name_ne",
  "short_description_en",
  "short_description_ne",
  "description_en",
  "description_ne",
  "specifications",
  "search_keywords",
  "sku",
  "base_price",
  "compare_at_price",
  "offer_title",
  "offer_type",
  "offer_value",
  "price_label",
  "unit_label",
  "available",
  "stock_managed",
  "featured",
  "districts",
  "published_at",
  "created_at",
  "updated_at",
].join(",");

function numberOrUndefined(value: number | string | null) {
  if (value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function specificationList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => typeof item === "string" ? [item] : []);
}

function toneFor(kind: ListingType, parentSlug: string): Listing["tone"] {
  if (kind === "service") return "blue";
  if (kind === "rental") return "earth";
  if (kind === "livestock") return "plum";
  if (kind === "produce") return "green";
  if (parentSlug === "seeds-inputs") return "gold";
  return "green";
}

export function buildListing(
  row: ListingRow,
  categories: CategoryRow[],
  imageRows: ListingImageRow[] = [],
  imageUrl?: (path: string) => string,
  variantRows: ListingVariantRow[] = [],
): Listing {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const selected = byId.get(row.category_id);
  const child = selected?.level === 2
    ? byId.get(selected.parent_id ?? "")
    : selected?.level === 1
      ? selected
      : undefined;
  const parent = selected?.level === 0
    ? selected
    : byId.get(child?.parent_id ?? "");
  const grandchild = selected?.level === 2 ? selected : undefined;
  const basePrice = numberOrUndefined(row.base_price);
  const legacyCompareAt = numberOrUndefined(row.compare_at_price);
  const offerValue = numberOrUndefined(row.offer_value);
  const hasListingOffer = Boolean(
    row.offer_title
    && row.offer_type
    && offerValue !== undefined
    && basePrice !== undefined
    && calculateOfferPrice(basePrice, row.offer_type, offerValue) < basePrice,
  );
  const listingPrice = basePrice === undefined
    ? undefined
    : hasListingOffer
      ? calculateOfferPrice(basePrice, row.offer_type, offerValue)
      : basePrice;
  const listingCompareAt = hasListingOffer
    ? basePrice
    : legacyCompareAt !== undefined && basePrice !== undefined && legacyCompareAt > basePrice
      ? legacyCompareAt
      : undefined;
  const parentSlug = parent?.slug ?? "produce";
  const variants: ListingVariant[] = variantRows
    .filter((variant) => variant.listing_id === row.id && variant.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name_en.localeCompare(b.name_en))
    .map((variant) => {
      const regularPrice = Number(variant.price);
      const variantOfferValue = numberOrUndefined(variant.offer_value);
      const hasVariantOffer = Boolean(
        variant.offer_title
        && variant.offer_type
        && variantOfferValue !== undefined
        && calculateOfferPrice(regularPrice, variant.offer_type, variantOfferValue) < regularPrice,
      );
      const price = hasVariantOffer
        ? calculateOfferPrice(regularPrice, variant.offer_type, variantOfferValue)
        : regularPrice;
      const legacyVariantCompareAt = numberOrUndefined(variant.compare_at_price);
      return {
        id: variant.id,
        name: variant.name_en,
        nameNe: variant.name_ne ?? undefined,
        sku: variant.sku ?? undefined,
        price,
        regularPrice,
        compareAt: hasVariantOffer
          ? regularPrice
          : legacyVariantCompareAt !== undefined && legacyVariantCompareAt > regularPrice
            ? legacyVariantCompareAt
            : undefined,
        offerTitle: hasVariantOffer ? variant.offer_title ?? undefined : undefined,
        offerType: hasVariantOffer ? variant.offer_type ?? undefined : undefined,
        offerValue: hasVariantOffer ? variantOfferValue : undefined,
        unit: variant.unit_label ?? row.unit_label ?? undefined,
        stockQuantity: Number(variant.stock_quantity),
        available: variant.is_active && Number(variant.stock_quantity) > 0,
        newArrival: isNewArrivalDate(variant.created_at),
        addedAt: variant.created_at,
      };
    });
  const lowestVariant = variants.length
    ? variants.reduce((lowest, variant) => variant.price < lowest.price ? variant : lowest)
    : undefined;
  const recentDates = [
    isNewArrivalDate(row.published_at) ? row.published_at : null,
    ...variants.map((variant) => variant.newArrival ? variant.addedAt ?? null : null),
  ].filter((value): value is string => Boolean(value));
  const newArrivalAt = recentDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  return {
    id: row.id,
    slug: row.slug,
    name: row.name_en,
    nameNe: row.name_ne ?? "",
    type: row.kind,
    categoryId: parentSlug,
    childCategory: child?.name_en ?? parent?.name_en ?? "Marketplace",
    grandchildCategory: grandchild?.name_en ?? child?.name_en ?? parent?.name_en ?? "Marketplace",
    description: row.short_description_en ?? row.description_en ?? "Explore this listing on khetE.",
    specifications: specificationList(row.specifications),
    tags: row.search_keywords ?? [],
    price: lowestVariant?.price ?? listingPrice,
    regularPrice: lowestVariant?.regularPrice ?? basePrice,
    compareAt: lowestVariant?.compareAt ?? listingCompareAt,
    offerTitle: lowestVariant?.offerTitle
      ?? (hasListingOffer ? row.offer_title ?? undefined : listingCompareAt ? "Special offer" : undefined),
    offerType: lowestVariant?.offerType ?? (hasListingOffer ? row.offer_type ?? undefined : undefined),
    offerValue: lowestVariant?.offerValue ?? (hasListingOffer ? offerValue : undefined),
    priceLabel: row.price_label ?? undefined,
    unit: row.unit_label ?? undefined,
    available: row.available,
    featured: row.featured,
    deal: Boolean(lowestVariant?.offerTitle || hasListingOffer || listingCompareAt),
    newArrival: Boolean(newArrivalAt),
    newArrivalAt,
    district: row.districts ?? [],
    images: imageRows
      .filter((image) => image.listing_id === row.id)
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)
      .map((image) => ({
        url: imageUrl ? imageUrl(image.storage_path) : image.storage_path,
        alt: image.alt_text_en ?? row.name_en,
        primary: image.is_primary,
      })),
    variants,
    tone: toneFor(row.kind, parentSlug),
  };
}

export function buildListings(
  rows: ListingRow[],
  categories: CategoryRow[],
  imageRows: ListingImageRow[] = [],
  imageUrl?: (path: string) => string,
  variantRows: ListingVariantRow[] = [],
) {
  return rows.map((row) => buildListing(row, categories, imageRows, imageUrl, variantRows));
}

export function slugifyListing(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

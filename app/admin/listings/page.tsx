"use client";
/* eslint-disable @next/next/no-img-element -- Admin previews must show the exact standardized master file. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Archive, BadgePercent, Boxes, CheckCircle2, ImagePlus, PackagePlus, Plus, Save, Star, Trash2, X } from "lucide-react";
import { AdminSidebar } from "@/components/admin-sidebar";
import { categoryLevelLabel, categorySelect, type CategoryRow } from "@/lib/categories";
import { listingSelect, listingVariantSelect, slugifyListing, type ListingImageRow, type ListingRow, type ListingStatus, type ListingVariantRow } from "@/lib/listings";
import { createClient } from "@/lib/supabase/client";
import type { ListingType } from "@/data/marketplace";
import { SearchableSelect } from "@/components/searchable-select";
import { safeStorageName, validateStandardImage } from "@/lib/image-processing";
import { AdminAccessCard, type AdminAccessState } from "@/components/admin-access-card";
import { calculateOfferPrice, offerSummary, type OfferType } from "@/lib/offers";

type InventoryRow = { listing_id: string; quantity: number | string; reserved_quantity: number | string; low_stock_threshold: number | string; allow_backorder: boolean };
type AdminListingImage = ListingImageRow & { url: string };
type AdminListingVariant = {
  id: string;
  nameEn: string;
  nameNe: string;
  sku: string;
  price: string;
  offerTitle: string;
  offerType: "" | OfferType;
  offerValue: string;
  unitLabel: string;
  stockQuantity: string;
  active: boolean;
  sortOrder: number;
  persisted: boolean;
  confirmed: boolean;
};

type AdminListing = {
  id: string;
  parentCategoryId: string;
  categoryId: string;
  kind: ListingType;
  status: ListingStatus;
  slug: string;
  nameEn: string;
  nameNe: string;
  shortDescriptionEn: string;
  shortDescriptionNe: string;
  descriptionEn: string;
  descriptionNe: string;
  specifications: string;
  keywords: string;
  sku: string;
  basePrice: string;
  offerTitle: string;
  offerType: "" | OfferType;
  offerValue: string;
  priceLabel: string;
  unitLabel: string;
  available: boolean;
  stockManaged: boolean;
  featured: boolean;
  districts: string;
  publishedAt: string | null;
  quantity: string;
  reservedQuantity: string;
  lowStockThreshold: string;
  allowBackorder: boolean;
  images: AdminListingImage[];
  variants: AdminListingVariant[];
};

type ListingFeedback = {
  tone: "error" | "success";
  title: string;
  message: string;
  targetId?: string;
  kind?: "listing" | "variant";
  variantIndex?: number;
};

const catalogRoles = new Set(["super_admin", "product_inventory_manager"]);
const statuses: ListingStatus[] = ["draft", "active", "inactive", "archived"];

function textList(value: string) {
  return value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
}

function numberValue(value: string) {
  return value.trim() === "" ? null : Number(value);
}

function offerValidationMessage(
  price: number | null,
  title: string,
  offerType: "" | OfferType,
  offerValue: number | null,
  subject: string,
) {
  const hasAnyOfferField = Boolean(title.trim() || offerType || offerValue !== null);
  if (!hasAnyOfferField) return null;
  if (!title.trim()) return `Enter an offer caption for ${subject}.`;
  if (!offerType) return `Choose Amount or Percentage for ${subject}.`;
  if (offerValue === null || !Number.isFinite(offerValue) || offerValue <= 0) return `Enter an offer value greater than 0 for ${subject}.`;
  if (price === null || !Number.isFinite(price) || price < 0) return `Enter the regular price before adding an offer for ${subject}.`;
  if (offerType === "percentage" && offerValue > 100) return `The percentage offer for ${subject} cannot be higher than 100%.`;
  if (offerType === "amount" && offerValue > price) return `The offer amount for ${subject} cannot be higher than its regular price.`;
  return null;
}

function rootCategoryId(categoryId: string, categories: CategoryRow[]) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  let current = byId.get(categoryId);
  while (current?.parent_id) current = byId.get(current.parent_id);
  return current?.id ?? "";
}

function listingTypeForParent(parentId: string, categories: CategoryRow[]): ListingType {
  const category = categories.find((item) => item.id === parentId);
  const value = `${category?.slug ?? ""} ${category?.name_en ?? ""}`.toLowerCase();
  if (value.includes("service")) return "service";
  if (value.includes("rental")) return "rental";
  if (value.includes("livestock")) return "livestock";
  if (value.includes("produce") || value.includes("grocery")) return "produce";
  return "product";
}

function fromVariantRow(row: ListingVariantRow): AdminListingVariant {
  return {
    id: row.id,
    nameEn: row.name_en,
    nameNe: row.name_ne ?? "",
    sku: row.sku ?? "",
    price: String(row.price),
    offerTitle: row.offer_title ?? "",
    offerType: row.offer_type ?? "",
    offerValue: row.offer_value === null ? "" : String(row.offer_value),
    unitLabel: row.unit_label ?? "",
    stockQuantity: String(row.stock_quantity),
    active: row.is_active,
    sortOrder: row.sort_order,
    persisted: true,
    confirmed: true,
  };
}

function emptyVariant(sortOrder: number): AdminListingVariant {
  return { id: crypto.randomUUID(), nameEn: "", nameNe: "", sku: "", price: "", offerTitle: "", offerType: "", offerValue: "", unitLabel: "", stockQuantity: "0", active: true, sortOrder, persisted: false, confirmed: false };
}

function variantTargetId(id: string) {
  return `listing-option-${id}`;
}

function fromRow(row: ListingRow, categories: CategoryRow[], inventory?: InventoryRow, images: AdminListingImage[] = [], variants: ListingVariantRow[] = []): AdminListing {
  return {
    id: row.id,
    parentCategoryId: rootCategoryId(row.category_id, categories),
    categoryId: row.category_id,
    kind: row.kind,
    status: row.status,
    slug: row.slug,
    nameEn: row.name_en,
    nameNe: row.name_ne ?? "",
    shortDescriptionEn: row.short_description_en ?? "",
    shortDescriptionNe: row.short_description_ne ?? "",
    descriptionEn: row.description_en ?? "",
    descriptionNe: row.description_ne ?? "",
    specifications: Array.isArray(row.specifications) ? row.specifications.filter((item): item is string => typeof item === "string").join("\n") : "",
    keywords: (row.search_keywords ?? []).join(", "),
    sku: row.sku ?? "",
    basePrice: row.base_price === null ? "" : String(row.base_price),
    offerTitle: row.offer_title ?? "",
    offerType: row.offer_type ?? "",
    offerValue: row.offer_value === null ? "" : String(row.offer_value),
    priceLabel: row.price_label ?? "",
    unitLabel: row.unit_label ?? "",
    available: row.available,
    stockManaged: row.stock_managed,
    featured: row.featured,
    districts: (row.districts ?? []).join(", "),
    publishedAt: row.published_at,
    quantity: inventory ? String(inventory.quantity) : "0",
    reservedQuantity: inventory ? String(inventory.reserved_quantity) : "0",
    lowStockThreshold: inventory ? String(inventory.low_stock_threshold) : "0",
    allowBackorder: inventory?.allow_backorder ?? false,
    images,
    variants: variants.filter((variant) => variant.listing_id === row.id).map(fromVariantRow),
  };
}

function emptyListing(): AdminListing {
  return {
    id: "",
    parentCategoryId: "",
    categoryId: "",
    kind: "product",
    status: "draft",
    slug: "",
    nameEn: "",
    nameNe: "",
    shortDescriptionEn: "",
    shortDescriptionNe: "",
    descriptionEn: "",
    descriptionNe: "",
    specifications: "",
    keywords: "",
    sku: "",
    basePrice: "",
    offerTitle: "",
    offerType: "",
    offerValue: "",
    priceLabel: "",
    unitLabel: "",
    available: true,
    stockManaged: true,
    featured: false,
    districts: "",
    publishedAt: null,
    quantity: "0",
    reservedQuantity: "0",
    lowStockThreshold: "0",
    allowBackorder: false,
    images: [],
    variants: [],
  };
}

export default function AdminListingsPage() {
  const [access, setAccess] = useState<AdminAccessState>("loading");
  const [accountEmail, setAccountEmail] = useState("");
  const [detectedRoles, setDetectedRoles] = useState<string[]>([]);
  const [currentOrigin, setCurrentOrigin] = useState("");
  const [userId, setUserId] = useState("");
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [items, setItems] = useState<AdminListing[]>([]);
  const [selected, setSelected] = useState<AdminListing | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingImages, setPendingImages] = useState<{ file: File; previewUrl: string }[]>([]);
  const [feedback, setFeedback] = useState<ListingFeedback | null>(null);

  const loadCatalogue = useCallback(async () => {
    const supabase = createClient();
    const [categoryResult, listingResult, inventoryResult, imageResult, variantResult] = await Promise.all([
      supabase.from("categories").select(categorySelect).order("level").order("sort_order").order("name_en"),
      supabase.from("listings").select(listingSelect).order("updated_at", { ascending: false }),
      supabase.from("inventory").select("listing_id,quantity,reserved_quantity,low_stock_threshold,allow_backorder"),
      supabase.from("listing_images").select("id,listing_id,storage_path,alt_text_en,alt_text_ne,sort_order,is_primary").order("is_primary", { ascending: false }).order("sort_order"),
      supabase.from("listing_variants").select(listingVariantSelect).order("sort_order").order("name_en"),
    ]);

    if (categoryResult.error) throw categoryResult.error;
    if (listingResult.error) throw listingResult.error;
    if (inventoryResult.error) throw inventoryResult.error;
    if (imageResult.error) throw imageResult.error;
    if (variantResult.error) throw new Error(`${variantResult.error.message}. Run supabase/listing-variants.sql once in the Supabase SQL Editor.`);

    const categoryRows = categoryResult.data as unknown as CategoryRow[];
    const inventoryRows = inventoryResult.data as unknown as InventoryRow[];
    const inventoryByListing = new Map(inventoryRows.map((row) => [row.listing_id, row]));
    const imageRows = imageResult.data as unknown as ListingImageRow[];
    const imagesByListing = new Map<string, AdminListingImage[]>();
    for (const image of imageRows) {
      const current = imagesByListing.get(image.listing_id) ?? [];
      current.push({ ...image, url: supabase.storage.from("marketplace-media").getPublicUrl(image.storage_path).data.publicUrl });
      imagesByListing.set(image.listing_id, current);
    }
    const variantRows = variantResult.data as unknown as ListingVariantRow[];
    const nextItems = (listingResult.data as unknown as ListingRow[]).map((row) => fromRow(row, categoryRows, inventoryByListing.get(row.id), imagesByListing.get(row.id) ?? [], variantRows));
    setCategories(categoryRows);
    setItems(nextItems);
    setSelected((current) => current?.id ? nextItems.find((item) => item.id === current.id) ?? current : current);
    return nextItems;
  }, []);

  useEffect(() => {
    let mounted = true;
    const checkAccess = async () => {
      try {
        if (mounted) setCurrentOrigin(window.location.origin);
        const supabase = createClient();
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) { if (mounted) setAccess("signed-out"); return; }
        if (mounted) setAccountEmail(authData.user.email ?? "");
        const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", authData.user.id);
        if (roleError) throw roleError;
        if (mounted) setDetectedRoles((roles ?? []).map((item) => item.role));
        if (!roles?.some((item) => catalogRoles.has(item.role))) { if (mounted) setAccess("denied"); return; }
        if (!mounted) return;
        setUserId(authData.user.id);
        setAccess("allowed");
        await loadCatalogue();
      } catch (caught) {
        if (!mounted) return;
        setError(caught instanceof Error ? caught.message : "The listing workspace could not be loaded.");
        setAccess("error");
      }
    };
    void checkAccess();
    return () => { mounted = false; };
  }, [loadCatalogue]);

  const categoryLabels = useMemo(() => {
    const byId = new Map(categories.map((item) => [item.id, item]));
    return new Map(categories.map((item) => {
      const parent = item.parent_id ? byId.get(item.parent_id) : undefined;
      const grandparent = parent?.parent_id ? byId.get(parent.parent_id) : undefined;
      return [item.id, [grandparent?.name_en, parent?.name_en, item.name_en].filter(Boolean).join(" › ")];
    }));
  }, [categories]);

  const parentCategoryOptions = useMemo(() => categories.filter((item) => item.is_active && item.level === 0).map((item) => ({
    value: item.id,
    label: item.name_en,
    keywords: `${item.name_en} ${item.name_ne ?? ""}`,
  })), [categories]);

  const categoryOptions = categories.filter((item) => item.is_active && (!selected?.parentCategoryId || rootCategoryId(item.id, categories) === selected.parentCategoryId)).map((item) => ({
    value: item.id,
    label: `${categoryLevelLabel(item.level)} · ${categoryLabels.get(item.id)}`,
    keywords: `${item.name_en} ${item.name_ne ?? ""} ${categoryLabels.get(item.id) ?? ""}`,
  }));

  function selectListing(listing: AdminListing | null) {
    pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setPendingImages([]);
    setError("");
    setNotice("");
    setFeedback(null);
    setSelected(listing);
  }

  function showSaveError(message: string, targetId?: string) {
    setError(message);
    setFeedback({
      tone: "error",
      title: "This listing needs attention",
      message,
      targetId,
    });
  }

  function errorTarget(message: string) {
    const normalized = message.toLowerCase();
    if (normalized.includes("option") || normalized.includes("variant")) return "listing-options";
    if (normalized.includes("inventory") || normalized.includes("stock") || normalized.includes("reserved")) return "inventory";
    if (normalized.includes("image") || normalized.includes("photo") || normalized.includes("storage") || normalized.includes("bucket")) return "listing-images";
    if (normalized.includes("slug") || normalized.includes("sku") || normalized.includes("duplicate") || normalized.includes("unique")) return "listing-advanced-details";
    return "listing-essential-details";
  }

  function goToFeedbackTarget() {
    const targetId = feedback?.targetId;
    setFeedback(null);
    if (!targetId) return;
    window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      if (!target) return;
      if (target instanceof HTMLDetailsElement) target.open = true;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      const firstField = target.querySelector<HTMLElement>("input:not([type='hidden']):not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled)");
      window.setTimeout(() => firstField?.focus({ preventScroll: true }), 350);
    });
  }

  function startAnotherListing() {
    selectListing(emptyListing());
    window.requestAnimationFrame(() => {
      document.getElementById("listing-essential-details")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function updateVariant(id: string, changes: Partial<AdminListingVariant>) {
    setSelected((current) => current ? { ...current, variants: current.variants.map((variant) => variant.id === id ? { ...variant, ...changes } : variant) } : current);
  }

  function showVariantResult(id: string) {
    if (!selected) return;
    const variant = selected.variants.find((item) => item.id === id);
    if (!variant) return;
    const index = selected.variants.findIndex((item) => item.id === id);
    const targetId = variantTargetId(id);
    const name = variant.nameEn.trim();
    const price = numberValue(variant.price);
    const stock = Number(variant.stockQuantity);
    if (!name) { showSaveError(`Enter an English name for product option ${index + 1}.`, targetId); return; }
    if (price === null || !Number.isFinite(price) || price < 0) { showSaveError(`Enter a valid regular price for ${name}.`, targetId); return; }
    if (!Number.isFinite(stock) || stock < 0) { showSaveError(`Stock for ${name} cannot be negative.`, targetId); return; }
    const offerError = offerValidationMessage(price, variant.offerTitle, variant.offerType, numberValue(variant.offerValue), name);
    if (offerError) { showSaveError(offerError, targetId); return; }
    updateVariant(id, { confirmed: true });
    setFeedback({
      tone: "success",
      kind: "variant",
      variantIndex: index,
      title: `${name} is ready`,
      message: "This option is complete and will be saved with the product listing. Add another option here, or continue to the product gallery.",
    });
  }

  function beginVariantEntry() {
    if (!selected) return;
    setFeedback(null);
    const existingDraft = selected.variants.find((variant) => !variant.confirmed);
    const nextVariant = existingDraft ?? emptyVariant(
      selected.variants.reduce((highest, variant) => Math.max(highest, variant.sortOrder), -1) + 1,
    );
    if (!existingDraft) {
      setSelected((current) => current ? { ...current, variants: [...current.variants, nextVariant] } : current);
    }
    window.requestAnimationFrame(() => {
      const target = document.getElementById(variantTargetId(nextVariant.id));
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => target?.querySelector<HTMLElement>("input")?.focus({ preventScroll: true }), 350);
    });
  }

  function addAnotherVariant() {
    beginVariantEntry();
  }

  function finishVariantEntry() {
    setFeedback(null);
    window.requestAnimationFrame(() => {
      document.getElementById("listing-images")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function removeVariant(id: string) {
    setSelected((current) => current ? { ...current, variants: current.variants.filter((variant) => variant.id !== id) } : current);
  }

  function renderVariantEditor(variant: AdminListingVariant, displayIndex: number, isDraft: boolean) {
    if (!selected) return null;
    const optionLabel = isDraft
      ? "New option"
      : variant.persisted
        ? `Saved option ${displayIndex + 1}`
        : `Option ${displayIndex + 1} · Ready to publish`;

    return (
      <article
        className={`listing-variant-editor ${isDraft ? "listing-variant-new" : "listing-variant-saved"}`}
        id={variantTargetId(variant.id)}
        key={variant.id}
      >
        <div className="listing-variant-editor-head">
          <strong>{optionLabel}{variant.nameEn ? ` · ${variant.nameEn}` : ""}</strong>
          <div>
            <label className="variant-active-toggle">
              <input type="checkbox" checked={variant.active} onChange={(event) => updateVariant(variant.id, { active: event.target.checked })} />
              Available
            </label>
            <button className="danger-icon-button" type="button" aria-label={`Remove ${variant.nameEn || optionLabel}`} onClick={() => removeVariant(variant.id)}><Trash2 /></button>
          </div>
        </div>
        {isDraft ? <p className="new-variant-position-note">Fill in the new option here. Previously added options remain below.</p> : null}
        <div className="form-grid">
          <label>English option name<input value={variant.nameEn} onChange={(event) => updateVariant(variant.id, { nameEn: event.target.value })} placeholder="Rohu" required /></label>
          <label>Nepali option name<input value={variant.nameNe} onChange={(event) => updateVariant(variant.id, { nameNe: event.target.value })} /></label>
          <label>Regular price (NPR)<input type="number" min="0" step="0.01" value={variant.price} onChange={(event) => updateVariant(variant.id, { price: event.target.value })} required /></label>
          <label>Stock quantity<input type="number" min="0" step="0.001" value={variant.stockQuantity} onChange={(event) => updateVariant(variant.id, { stockQuantity: event.target.value })} /></label>
          <label>Unit label<input value={variant.unitLabel} onChange={(event) => updateVariant(variant.id, { unitLabel: event.target.value })} placeholder={selected.unitLabel || "piece, 1000 fry, kg"} /></label>
          <label>SKU<input value={variant.sku} onChange={(event) => updateVariant(variant.id, { sku: event.target.value })} placeholder="Optional unique stock code" /></label>
          <label className="span-two">Offer caption<input value={variant.offerTitle} onChange={(event) => updateVariant(variant.id, { offerTitle: event.target.value })} placeholder="Pond Stocking Offer" /></label>
          <label>Offer calculation<select value={variant.offerType} onChange={(event) => updateVariant(variant.id, { offerType: event.target.value as "" | OfferType })}><option value="">No offer</option><option value="amount">Amount (NPR)</option><option value="percentage">Percentage (%)</option></select></label>
          <label>{variant.offerType === "percentage" ? "Percentage value" : "Offer amount (NPR)"}<input type="number" min="0" max={variant.offerType === "percentage" ? "100" : undefined} step="0.01" value={variant.offerValue} onChange={(event) => updateVariant(variant.id, { offerValue: event.target.value })} disabled={!variant.offerType} /></label>
        </div>
        {variant.offerType && numberValue(variant.price) !== null && numberValue(variant.offerValue) !== null ? (
          <div className="offer-price-preview compact">
            <span><strong>{variant.offerTitle.trim() || "Offer preview"}</strong>{offerSummary(variant.offerType, numberValue(variant.offerValue) ?? 0)}</span>
            <span><small>Customer price</small><del>NPR {Number(variant.price).toLocaleString("en-NP")}</del><b>NPR {calculateOfferPrice(Number(variant.price), variant.offerType, numberValue(variant.offerValue)).toLocaleString("en-NP")}</b></span>
          </div>
        ) : null}
        <div className="variant-editor-actions">
          <small>{isDraft ? "Confirm this option, then choose Add another variant or Done adding variants." : "Save & publish writes this option and the complete product to the catalogue."}</small>
          <button type="button" onClick={() => showVariantResult(variant.id)}><Save /> {isDraft ? "Save option" : "Confirm changes"}</button>
        </div>
      </article>
    );
  }

  async function chooseListingImages(files: FileList | null) {
    if (!files?.length || !selected) return;
    const remaining = 8 - selected.images.length - pendingImages.length;
    if (remaining <= 0) { setError("A listing can contain a maximum of 8 images."); return; }
    if (files.length > remaining) { setError(`You can add only ${remaining} more image${remaining === 1 ? "" : "s"}.`); return; }
    setError("");
    const checked: { file: File; previewUrl: string }[] = [];
    try {
      for (const file of Array.from(files)) {
        const image = await validateStandardImage(file, { width: 1254, height: 1254, maxBytes: 5 * 1024 * 1024, label: "Listing photo" });
        checked.push({ file: image.file, previewUrl: image.previewUrl });
      }
      setPendingImages((current) => [...current, ...checked]);
    } catch (caught) {
      checked.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      setError(caught instanceof Error ? caught.message : "The selected images could not be prepared.");
    }
  }

  async function removeSavedImage(image: AdminListingImage) {
    if (!selected?.id) return;
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: rowError } = await supabase.from("listing_images").delete().eq("id", image.id);
    if (!rowError) await supabase.storage.from("marketplace-media").remove([image.storage_path]);
    if (!rowError && image.is_primary) {
      const replacement = selected.images.filter((item) => item.id !== image.id).sort((a, b) => a.sort_order - b.sort_order)[0];
      if (replacement) await supabase.from("listing_images").update({ is_primary: true }).eq("id", replacement.id);
    }
    setSaving(false);
    if (rowError) { setError(rowError.message); return; }
    const refreshed = await loadCatalogue();
    setSelected(refreshed.find((item) => item.id === selected.id) ?? null);
    setNotice("Listing image removed.");
  }

  async function makePrimary(image: AdminListingImage) {
    if (!selected?.id || image.is_primary) return;
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: clearError } = await supabase.from("listing_images").update({ is_primary: false }).eq("listing_id", selected.id).eq("is_primary", true);
    const { error: primaryError } = clearError ? { error: clearError } : await supabase.from("listing_images").update({ is_primary: true }).eq("id", image.id);
    setSaving(false);
    if (primaryError) { setError(primaryError.message); return; }
    const refreshed = await loadCatalogue();
    setSelected(refreshed.find((item) => item.id === selected.id) ?? null);
    setNotice("Primary image updated.");
  }

  async function save() {
    if (!selected) return;
    if (!userId) {
      showSaveError("Your admin session is no longer available. Sign in again before saving this listing.");
      return;
    }
    setError("");
    setNotice("");
    setFeedback(null);
    const slug = selected.slug || slugifyListing(selected.nameEn);
    if (!selected.nameEn.trim()) { showSaveError("Enter the English product name.", "listing-essential-details"); return; }
    if (!slug) { showSaveError("Enter a valid product name or slug.", "listing-advanced-details"); return; }
    if (!selected.parentCategoryId) { showSaveError("Choose a parent category.", "listing-essential-details"); return; }
    if (!selected.categoryId) { showSaveError("Choose the specific category for this product.", "listing-essential-details"); return; }
    const basePrice = numberValue(selected.basePrice);
    if (basePrice !== null && (!Number.isFinite(basePrice) || basePrice < 0)) { showSaveError("Enter a valid regular price.", "listing-essential-details"); return; }
    if (!selected.variants.length) {
      const listingOfferError = offerValidationMessage(basePrice, selected.offerTitle, selected.offerType, numberValue(selected.offerValue), selected.nameEn.trim() || "this product");
      if (listingOfferError) { showSaveError(listingOfferError, "listing-offer"); return; }
    }
    const preparedVariants = selected.variants.map((variant) => ({
      ...variant,
      nameEn: variant.nameEn.trim(),
      nameNe: variant.nameNe.trim(),
      sku: variant.sku.trim(),
      priceNumber: numberValue(variant.price),
      offerTitle: variant.offerTitle.trim(),
      offerValueNumber: numberValue(variant.offerValue),
      stockNumber: Number(variant.stockQuantity) || 0,
      sortOrder: variant.sortOrder,
    }));
    for (let index = 0; index < preparedVariants.length; index += 1) {
      const variant = preparedVariants[index];
      const targetId = variantTargetId(variant.id);
      if (!variant.nameEn) { showSaveError(`Enter an English name for product option ${index + 1}.`, targetId); return; }
      if (variant.priceNumber === null || !Number.isFinite(variant.priceNumber) || variant.priceNumber < 0) { showSaveError(`Enter a valid regular price for ${variant.nameEn}.`, targetId); return; }
      if (variant.stockNumber < 0) { showSaveError(`Stock for ${variant.nameEn} cannot be negative.`, targetId); return; }
      const variantOfferError = offerValidationMessage(variant.priceNumber, variant.offerTitle, variant.offerType, variant.offerValueNumber, variant.nameEn);
      if (variantOfferError) { showSaveError(variantOfferError, targetId); return; }
    }
    const quantity = Number(selected.quantity) || 0;
    const reservedQuantity = Number(selected.reservedQuantity) || 0;
    if (selected.stockManaged && !preparedVariants.length && (quantity < 0 || reservedQuantity < 0)) {
      showSaveError("Inventory and reserved quantities cannot be negative.", "inventory");
      return;
    }
    if (selected.stockManaged && !preparedVariants.length && !selected.allowBackorder && reservedQuantity > quantity) {
      showSaveError("Reserved quantity cannot be higher than the available inventory unless backorders are enabled.", "inventory");
      return;
    }
    const lowestVariantPrice = preparedVariants.length ? Math.min(...preparedVariants.map((variant) => variant.priceNumber as number)) : null;

    setSaving(true);
    const supabase = createClient();
    const payload = {
      category_id: selected.categoryId,
      kind: listingTypeForParent(selected.parentCategoryId, categories),
      status: selected.status,
      slug,
      name_en: selected.nameEn.trim(),
      name_ne: selected.nameNe.trim() || null,
      short_description_en: selected.shortDescriptionEn.trim() || null,
      short_description_ne: selected.shortDescriptionNe.trim() || null,
      description_en: selected.descriptionEn.trim() || null,
      description_ne: selected.descriptionNe.trim() || null,
      specifications: textList(selected.specifications),
      search_keywords: textList(selected.keywords),
      sku: selected.sku.trim() || null,
      base_price: lowestVariantPrice ?? basePrice,
      compare_at_price: null,
      offer_title: preparedVariants.length ? null : selected.offerTitle.trim() || null,
      offer_type: preparedVariants.length ? null : selected.offerType || null,
      offer_value: preparedVariants.length ? null : numberValue(selected.offerValue),
      price_label: selected.priceLabel.trim() || null,
      unit_label: selected.unitLabel.trim() || null,
      available: selected.available,
      stock_managed: selected.stockManaged,
      featured: selected.featured,
      districts: textList(selected.districts),
      published_at: selected.status === "active" ? selected.publishedAt ?? new Date().toISOString() : null,
      updated_by: userId,
    };

    const operation = selected.id
      ? supabase.from("listings").update(payload).eq("id", selected.id).select(listingSelect).single()
      : supabase.from("listings").insert({ ...payload, created_by: userId }).select(listingSelect).single();
    const { data, error: listingError } = await operation;
    if (listingError || !data) {
      setSaving(false);
      const message = listingError?.message ?? "The listing could not be saved.";
      showSaveError(message, errorTarget(message));
      return;
    }

    const savedRow = data as unknown as ListingRow;
    const { data: existingVariantData, error: existingVariantError } = await supabase.from("listing_variants").select("id").eq("listing_id", savedRow.id);
    if (existingVariantError) {
      setSaving(false);
      showSaveError(`Listing saved, but product options could not be read: ${existingVariantError.message}`, "listing-options");
      return;
    }
    if (preparedVariants.length) {
      const { error: variantError } = await supabase.from("listing_variants").upsert(preparedVariants.map((variant) => ({
        id: variant.id,
        listing_id: savedRow.id,
        name_en: variant.nameEn,
        name_ne: variant.nameNe || null,
        sku: variant.sku || null,
        price: variant.priceNumber,
        compare_at_price: null,
        offer_title: variant.offerTitle || null,
        offer_type: variant.offerType || null,
        offer_value: variant.offerValueNumber,
        unit_label: variant.unitLabel.trim() || selected.unitLabel.trim() || null,
        stock_quantity: variant.stockNumber,
        is_active: variant.active,
        sort_order: variant.sortOrder,
      })));
      if (variantError) {
        setSaving(false);
        showSaveError(`Listing saved, but product options failed: ${variantError.message}`, "listing-options");
        return;
      }
    }
    const keptVariantIds = new Set(preparedVariants.map((variant) => variant.id));
    const removedVariantIds = (existingVariantData ?? []).map((variant) => variant.id).filter((id) => !keptVariantIds.has(id));
    if (removedVariantIds.length) {
      const { error: removalError } = await supabase.from("listing_variants").delete().in("id", removedVariantIds);
      if (removalError) {
        setSaving(false);
        showSaveError(`Listing saved, but removed options could not be cleared: ${removalError.message}`, "listing-options");
        return;
      }
    }

    if (selected.stockManaged && !preparedVariants.length) {
      const { error: inventoryError } = await supabase.from("inventory").upsert({
        listing_id: savedRow.id,
        quantity: Number(selected.quantity) || 0,
        reserved_quantity: Number(selected.reservedQuantity) || 0,
        low_stock_threshold: Number(selected.lowStockThreshold) || 0,
        allow_backorder: selected.allowBackorder,
        updated_by: userId,
      }, { onConflict: "listing_id" });
      if (inventoryError) {
        setSaving(false);
        showSaveError(`Listing saved, but inventory failed: ${inventoryError.message}`, "inventory");
        return;
      }
    }

    let imageUploadError = "";
    for (let index = 0; index < pendingImages.length; index += 1) {
      const pending = pendingImages[index];
      const storagePath = `listings/${savedRow.id}/${safeStorageName(pending.file)}`;
      const { error: uploadError } = await supabase.storage.from("marketplace-media").upload(storagePath, pending.file, {
        cacheControl: "31536000",
        contentType: pending.file.type,
        upsert: false,
      });
      if (uploadError) { imageUploadError = uploadError.message; break; }
      const { error: imageRowError } = await supabase.from("listing_images").insert({
        listing_id: savedRow.id,
        storage_path: storagePath,
        alt_text_en: savedRow.name_en,
        sort_order: selected.images.length + index,
        is_primary: !selected.images.some((image) => image.is_primary) && index === 0,
      });
      if (imageRowError) { imageUploadError = imageRowError.message; break; }
    }

    setSaving(false);
    pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setPendingImages([]);
    const refreshed = await loadCatalogue();
    setSelected(refreshed.find((item) => item.id === savedRow.id) ?? null);
    if (imageUploadError) {
      showSaveError(`Listing saved, but an image was not uploaded: ${imageUploadError}. Run supabase/storage-media.sql once, then try again.`, "listing-images");
      return;
    }
    const successMessage = selected.status === "active"
      ? `${savedRow.name_en} was published to the live marketplace.`
      : `${savedRow.name_en} was saved successfully.`;
    setNotice(successMessage);
    setFeedback({
      tone: "success",
      title: selected.status === "active" ? "Product published successfully" : "Listing saved successfully",
      message: `${successMessage} You can now open a fresh form and add another product.`,
    });
  }

  async function archiveSelected() {
    if (!selected?.id || !userId) return;
    setSaving(true);
    const supabase = createClient();
    const { error: archiveError } = await supabase.from("listings").update({ status: "archived", available: false, published_at: null, updated_by: userId }).eq("id", selected.id);
    setSaving(false);
    if (archiveError) { setError(archiveError.message); return; }
    await loadCatalogue();
    setNotice("Listing archived. Its record and inventory were preserved.");
  }

  if (access !== "allowed") {
    return <AdminAccessCard access={access} error={error} email={accountEmail} roles={detectedRoles} origin={currentOrigin} resource="listings" />;
  }

  return (
    <div className="admin-shell">
      <AdminSidebar active="listings" />
      <main className="admin-main">
        <header className="admin-page-heading"><div><p className="eyebrow">Live Supabase catalogue</p><h1>Listings & inventory</h1><p>Add the essential details first. Optional information stays out of the way until you need it.</p></div><div className="admin-create-actions"><button className="primary-button" type="button" onClick={() => selectListing(emptyListing())}><PackagePlus /> New listing</button><button type="button" onClick={() => void loadCatalogue()}><Boxes /> Refresh</button></div></header>
        {notice ? <div className="admin-notice">{notice}<button type="button" onClick={() => setNotice("")}><X /></button></div> : null}
        {error ? <div className="admin-notice admin-error-notice">{error}<button type="button" onClick={() => setError("")}><X /></button></div> : null}
        <div className="admin-listing-layout">
          <section className="listing-list-panel">
            <div className="panel-heading"><div><h2>Catalogue</h2><span>{items.length} records</span></div><button type="button" onClick={() => selectListing(emptyListing())}>Add new</button></div>
            <div className="admin-listing-list">{items.map((item) => <button className={selected?.id === item.id ? "selected" : ""} type="button" key={item.id} onClick={() => selectListing(item)}><span><strong>{item.nameEn}</strong><small>{categoryLabels.get(item.categoryId) ?? "Uncategorised"}</small></span><em className={`listing-status status-${item.status}`}>{item.status}</em></button>)}{!items.length ? <div className="admin-list-empty"><PackagePlus /><p>No live records yet. Create the first listing.</p></div> : null}</div>
          </section>

          <section className="category-edit-panel">
            {selected ? <><div className="panel-heading"><div><p className="eyebrow">{selected.id ? "Edit listing" : "Create listing"}</p><h2>{selected.nameEn || "New marketplace listing"}</h2></div><span className={`listing-status status-${selected.status}`}>{selected.status}</span></div>
              <form className="admin-form" noValidate onSubmit={(event) => { event.preventDefault(); void save(); }}>
                <section className="admin-form-section" id="listing-essential-details">
                  <div className="admin-form-section-heading"><div><h3>Essential details</h3><p>Complete these fields first. You can save as a draft and return later.</p></div></div>
                  <div className="form-grid">
                    <label>English name<input value={selected.nameEn} onChange={(event) => setSelected({ ...selected, nameEn: event.target.value })} onBlur={() => !selected.slug && setSelected({ ...selected, slug: slugifyListing(selected.nameEn) })} required /></label>
                    <label>Nepali name<input value={selected.nameNe} onChange={(event) => setSelected({ ...selected, nameNe: event.target.value })} /></label>
                    <div className="form-field"><span>Parent category</span><SearchableSelect value={selected.parentCategoryId} onChange={(value) => setSelected({ ...selected, parentCategoryId: value, categoryId: value, kind: listingTypeForParent(value, categories) })} placeholder="Choose a parent category" searchPlaceholder="Type Produce, Livestock, Machinery…" options={parentCategoryOptions} /></div>
                    <label>Status<select value={selected.status} onChange={(event) => setSelected({ ...selected, status: event.target.value as ListingStatus })}>{statuses.map((status) => <option value={status} key={status}>{status}</option>)}</select></label>
                    <div className="form-field span-two"><span>Specific category</span><SearchableSelect value={selected.categoryId} onChange={(value) => setSelected({ ...selected, categoryId: value })} disabled={!selected.parentCategoryId} placeholder={selected.parentCategoryId ? "Choose the parent, child or grandchild" : "Choose a parent category first"} searchPlaceholder="Type Grains, Hatchlings, Tractors…" options={categoryOptions} /></div>
                    <label className="span-two">Short English description<textarea rows={3} value={selected.shortDescriptionEn} onChange={(event) => setSelected({ ...selected, shortDescriptionEn: event.target.value })} placeholder="A short description shown on cards and search results" /></label>
                    <label>Regular price (NPR)<input type="number" min="0" step="0.01" value={selected.basePrice} onChange={(event) => setSelected({ ...selected, basePrice: event.target.value })} /></label>
                    <label>Unit label<input value={selected.unitLabel} onChange={(event) => setSelected({ ...selected, unitLabel: event.target.value })} placeholder="kg, unit, bundle, day" /></label>
                  </div>
                </section>

                {!selected.variants.length ? (
                  <section className="listing-offer-panel" id="listing-offer">
                    <div className="admin-form-section-heading"><div><h3>Optional product offer</h3><p>Give the offer its own caption and choose a fixed NPR amount or a percentage. Leave all three fields blank when there is no offer.</p></div><BadgePercent /></div>
                    <div className="form-grid">
                      <label className="span-two">Offer caption<input value={selected.offerTitle} onChange={(event) => setSelected({ ...selected, offerTitle: event.target.value })} placeholder="Monsoon Farm Offer" /></label>
                      <label>Offer calculation<select value={selected.offerType} onChange={(event) => setSelected({ ...selected, offerType: event.target.value as "" | OfferType })}><option value="">No offer</option><option value="amount">Amount (NPR)</option><option value="percentage">Percentage (%)</option></select></label>
                      <label>{selected.offerType === "percentage" ? "Percentage value" : "Offer amount (NPR)"}<input type="number" min="0" max={selected.offerType === "percentage" ? "100" : undefined} step="0.01" value={selected.offerValue} onChange={(event) => setSelected({ ...selected, offerValue: event.target.value })} disabled={!selected.offerType} /></label>
                    </div>
                    {selected.offerType && numberValue(selected.basePrice) !== null && numberValue(selected.offerValue) !== null ? <div className="offer-price-preview"><span><strong>{selected.offerTitle.trim() || "Offer preview"}</strong>{offerSummary(selected.offerType, numberValue(selected.offerValue) ?? 0)}</span><span><small>Customer price</small><del>NPR {Number(selected.basePrice).toLocaleString("en-NP")}</del><b>NPR {calculateOfferPrice(Number(selected.basePrice), selected.offerType, numberValue(selected.offerValue)).toLocaleString("en-NP")}</b></span></div> : null}
                  </section>
                ) : <div className="variant-inventory-note"><BadgePercent /> Offers are set separately inside each product option below.</div>}

                <section className="listing-variant-manager" id="listing-options">
                  <div className="admin-form-section-heading">
                    <div><h3>Purchasable product options</h3><p>Add varieties sold from this one listing. A new blank option always opens here, above options you already added.</p></div>
                    <button type="button" onClick={beginVariantEntry}><Plus /> Add option</button>
                  </div>
                  {selected.variants.some((variant) => !variant.confirmed) ? (
                    <div className="new-variant-entry">
                      <div className="variant-group-heading"><span>New variant</span><small>Complete this first</small></div>
                      {selected.variants.filter((variant) => !variant.confirmed).map((variant) => renderVariantEditor(variant, 0, true))}
                    </div>
                  ) : null}
                  {selected.variants.some((variant) => variant.confirmed) ? (
                    <div className="saved-variant-entry">
                      <div className="variant-group-heading"><span>Previously added variants</span><small>{selected.variants.filter((variant) => variant.confirmed).length} option{selected.variants.filter((variant) => variant.confirmed).length === 1 ? "" : "s"}</small></div>
                      <div className="listing-variant-list">
                        {selected.variants.filter((variant) => variant.confirmed).map((variant, index) => renderVariantEditor(variant, index, false))}
                      </div>
                    </div>
                  ) : null}
                  {!selected.variants.length ? <div className="variant-empty-state"><Boxes /><div><strong>Single-option listing</strong><span>Add Rohu, Naini, Common Carp or any other independently priced choices here.</span></div></div> : null}
                </section>

                <section className="listing-image-manager" id="listing-images">
                  <div className="admin-form-section-heading"><div><h3>Product gallery</h3><p>Upload one standard master file for each view. The same file is reused everywhere on the website.</p></div><strong>{selected.images.length + pendingImages.length}/8</strong></div>
                  <div className="image-standard-note"><ImagePlus /><div><strong>Mandatory image standard</strong><span>Exactly 1254 × 1254 px · the complete product centred with about 10% clear space · white or light neutral background · JPG, PNG or WebP · maximum 5 MB each.</span></div></div>
                  <div className="listing-image-grid">
                    {selected.images.map((image) => <article className="listing-image-card" key={image.id}><div className="listing-image-preview"><img src={image.url} alt={image.alt_text_en || selected.nameEn || "Listing image"} />{image.is_primary ? <span>Primary</span> : null}</div><div className="listing-image-actions">{!image.is_primary ? <button type="button" disabled={saving} onClick={() => void makePrimary(image)}><Star /> Make primary</button> : <small>Shown first</small>}<button className="danger-icon-button" type="button" aria-label="Remove image" disabled={saving} onClick={() => void removeSavedImage(image)}><Trash2 /></button></div></article>)}
                    {pendingImages.map((image, index) => <article className="listing-image-card pending" key={image.previewUrl}><div className="listing-image-preview"><img src={image.previewUrl} alt="New listing image preview" />{!selected.images.some((item) => item.is_primary) && index === 0 ? <span>Will be primary</span> : <span>Ready to upload</span>}</div><div className="listing-image-actions"><small>Saved with listing</small><button className="danger-icon-button" type="button" aria-label="Remove pending image" onClick={() => setPendingImages((current) => current.filter((item) => { if (item.previewUrl === image.previewUrl) URL.revokeObjectURL(item.previewUrl); return item.previewUrl !== image.previewUrl; }))}><Trash2 /></button></div></article>)}
                    {selected.images.length + pendingImages.length < 8 ? <label className="listing-image-add"><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { void chooseListingImages(event.target.files); event.currentTarget.value = ""; }} /><ImagePlus /><strong>Add photos</strong><span>1254 × 1254 px only</span></label> : null}
                  </div>
                </section>

                <div className="admin-switches"><label><input type="checkbox" checked={selected.available} onChange={(event) => setSelected({ ...selected, available: event.target.checked })} /><span>Available</span></label><label><input type="checkbox" checked={selected.stockManaged} onChange={(event) => setSelected({ ...selected, stockManaged: event.target.checked })} /><span>Manage stock</span></label><label><input type="checkbox" checked={selected.featured} onChange={(event) => setSelected({ ...selected, featured: event.target.checked })} /><span>Feature on homepage</span></label></div>

                {selected.stockManaged && !selected.variants.length ? <fieldset className="inventory-fieldset" id="inventory"><legend>Inventory</legend><div className="form-grid"><label>Quantity<input type="number" min="0" step="0.001" value={selected.quantity} onChange={(event) => setSelected({ ...selected, quantity: event.target.value })} /></label><label>Low-stock warning<input type="number" min="0" step="0.001" value={selected.lowStockThreshold} onChange={(event) => setSelected({ ...selected, lowStockThreshold: event.target.value })} /></label><label>Reserved quantity<input type="number" min="0" step="0.001" value={selected.reservedQuantity} onChange={(event) => setSelected({ ...selected, reservedQuantity: event.target.value })} /></label><label className="inventory-check"><input type="checkbox" checked={selected.allowBackorder} onChange={(event) => setSelected({ ...selected, allowBackorder: event.target.checked })} /> Allow backorders</label></div></fieldset> : selected.stockManaged && selected.variants.length ? <div className="variant-inventory-note">Stock is managed separately inside each product option above.</div> : null}

                <details className="admin-advanced-details" id="listing-advanced-details">
                  <summary>Additional details <span>Descriptions, SKU, specifications, search and delivery</span></summary>
                  <div className="form-grid">
                    <label>Slug<input value={selected.slug} onChange={(event) => setSelected({ ...selected, slug: slugifyListing(event.target.value) })} placeholder="Generated from the English name" /></label>
                    <label>SKU<input value={selected.sku} onChange={(event) => setSelected({ ...selected, sku: event.target.value })} placeholder="Optional unique code" /></label>
                    <label>Price label<input value={selected.priceLabel} onChange={(event) => setSelected({ ...selected, priceLabel: event.target.value })} placeholder="From Rs. 8,500 / Enquire" /></label>
                    <label className="span-two">Short Nepali description<textarea rows={2} value={selected.shortDescriptionNe} onChange={(event) => setSelected({ ...selected, shortDescriptionNe: event.target.value })} /></label>
                    <label className="span-two">Full English description<textarea rows={4} value={selected.descriptionEn} onChange={(event) => setSelected({ ...selected, descriptionEn: event.target.value })} /></label>
                    <label className="span-two">Full Nepali description<textarea rows={4} value={selected.descriptionNe} onChange={(event) => setSelected({ ...selected, descriptionNe: event.target.value })} /></label>
                    <label className="span-two">Specifications — one per line<textarea rows={5} value={selected.specifications} onChange={(event) => setSelected({ ...selected, specifications: event.target.value })} /></label>
                    <label className="span-two">Search keywords — comma separated<input value={selected.keywords} onChange={(event) => setSelected({ ...selected, keywords: event.target.value })} placeholder="tractor, 20 hp, diesel, ट्र्याक्टर" /></label>
                    <label className="span-two">Delivery districts — comma separated<input value={selected.districts} onChange={(event) => setSelected({ ...selected, districts: event.target.value })} /></label>
                  </div>
                </details>

                <div className="admin-form-actions"><button className="primary-button" type="submit" disabled={saving}><Save /> {saving ? "Saving…" : selected.status === "active" ? "Save & publish" : "Save listing"}</button>{selected.id ? <button type="button" onClick={() => void archiveSelected()} disabled={saving || selected.status === "archived"}><Archive /> Archive</button> : null}</div>
              </form></> : <div className="admin-empty-panel"><PackagePlus /><h2>No listing selected</h2><p>Choose New listing to start with empty fields, or click an existing record to edit it.</p></div>}
          </section>
        </div>
      </main>
      {feedback ? (
        <div className="listing-feedback-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setFeedback(null)}>
          <section className={`listing-feedback-dialog ${feedback.tone}`} role="dialog" aria-modal="true" aria-labelledby="listing-feedback-title">
            <button className="listing-feedback-close" type="button" onClick={() => setFeedback(null)} aria-label="Close message"><X /></button>
            <span className="listing-feedback-icon">{feedback.tone === "success" ? <CheckCircle2 /> : <AlertCircle />}</span>
            <p className="eyebrow">{feedback.tone === "success" ? "Listing complete" : "Check the listing"}</p>
            <h2 id="listing-feedback-title">{feedback.title}</h2>
            <p>{feedback.message}</p>
            <div className="listing-feedback-actions">
              {feedback.tone === "success" && feedback.kind === "variant" ? (
                <>
                  <button className="secondary-button" type="button" onClick={finishVariantEntry}>Done adding variants</button>
                  <button className="primary-button" type="button" onClick={addAnotherVariant}><Plus /> Add another variant</button>
                </>
              ) : feedback.tone === "success" ? (
                <>
                  <button className="secondary-button" type="button" onClick={() => setFeedback(null)}>Stay on this listing</button>
                  <button className="primary-button" type="button" onClick={startAnotherListing}><PackagePlus /> Add another product</button>
                </>
              ) : (
                <>
                  <button className="secondary-button" type="button" onClick={() => setFeedback(null)}>Close</button>
                  {feedback.targetId ? <button className="primary-button" type="button" onClick={goToFeedbackTarget}>Go to problem section</button> : null}
                </>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

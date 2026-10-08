"use client";
/* eslint-disable @next/next/no-img-element -- Admin previews show the exact Supabase campaign master. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, CalendarDays, Eye, ImagePlus, LoaderCircle, Megaphone, Plus, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import { AdminAccessCard, type AdminAccessState } from "@/components/admin-access-card";
import { AdminSidebar } from "@/components/admin-sidebar";
import { SearchableSelect } from "@/components/searchable-select";
import { categoryLevelLabel, categorySelect, type CategoryRow } from "@/lib/categories";
import { safeStorageName, validateStandardImage } from "@/lib/image-processing";
import { fromDateTimeLocal, promotionSelect, promotionState, toDateTimeLocal, type PromotionRow, type PromotionTarget, type PromotionTheme } from "@/lib/promotions";
import { createClient } from "@/lib/supabase/client";

type TargetListing = {
  id: string;
  slug: string;
  name_en: string;
  kind: string;
  status: string;
};

type AdminPromotion = {
  id: string;
  titleEn: string;
  titleNe: string;
  eyebrowEn: string;
  eyebrowNe: string;
  descriptionEn: string;
  descriptionNe: string;
  buttonLabelEn: string;
  buttonLabelNe: string;
  targetType: PromotionTarget;
  targetListingId: string;
  targetCategoryId: string;
  bannerStoragePath: string;
  theme: PromotionTheme;
  showOnHomepage: boolean;
  showOnDealsPage: boolean;
  active: boolean;
  sortOrder: number;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
};

const promotionRoles = new Set(["super_admin", "content_promotion_manager"]);
const themes: PromotionTheme[] = ["green", "gold", "sand", "blue", "plum"];
const mediaBucket = "marketplace-media";

function fromRow(row: PromotionRow): AdminPromotion {
  return {
    id: row.id,
    titleEn: row.title_en,
    titleNe: row.title_ne ?? "",
    eyebrowEn: row.eyebrow_en ?? "",
    eyebrowNe: row.eyebrow_ne ?? "",
    descriptionEn: row.description_en ?? "",
    descriptionNe: row.description_ne ?? "",
    buttonLabelEn: row.button_label_en,
    buttonLabelNe: row.button_label_ne ?? "",
    targetType: row.target_type,
    targetListingId: row.target_listing_id ?? "",
    targetCategoryId: row.target_category_id ?? "",
    bannerStoragePath: row.banner_storage_path ?? "",
    theme: row.theme,
    showOnHomepage: row.show_on_homepage,
    showOnDealsPage: row.show_on_deals_page,
    active: row.is_active,
    sortOrder: row.sort_order,
    startsAt: toDateTimeLocal(row.starts_at),
    endsAt: toDateTimeLocal(row.ends_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function emptyPromotion(items: AdminPromotion[]): AdminPromotion {
  return {
    id: "",
    titleEn: "",
    titleNe: "",
    eyebrowEn: "Seasonal offer",
    eyebrowNe: "",
    descriptionEn: "",
    descriptionNe: "",
    buttonLabelEn: "Explore offer",
    buttonLabelNe: "",
    targetType: "deals",
    targetListingId: "",
    targetCategoryId: "",
    bannerStoragePath: "",
    theme: "green",
    showOnHomepage: true,
    showOnDealsPage: true,
    active: true,
    sortOrder: items.length * 10 + 10,
    startsAt: toDateTimeLocal(new Date().toISOString()),
    endsAt: "",
    createdAt: "",
    updatedAt: "",
  };
}

function statusFor(item: AdminPromotion) {
  return promotionState({
    is_active: item.active,
    starts_at: fromDateTimeLocal(item.startsAt) ?? new Date().toISOString(),
    ends_at: fromDateTimeLocal(item.endsAt),
  });
}

function errorMessage(value: unknown) {
  const message = value instanceof Error
    ? value.message
    : value && typeof value === "object" && "message" in value && typeof value.message === "string"
      ? value.message
      : "The promotions workspace could not be loaded.";
  const normalized = message.toLowerCase();
  if (normalized.includes("relation") || normalized.includes("schema cache") || normalized.includes("app_role")) {
    return "Run supabase/migrations/202607230002_promotions_access_repair.sql in the Supabase SQL Editor, then choose Refresh.";
  }
  if (normalized.includes("permission denied") || normalized.includes("row-level security")) {
    return "The promotion permissions need repair. Run supabase/migrations/202607230002_promotions_access_repair.sql in Supabase, then choose Refresh.";
  }
  return message;
}

export default function AdminPromotionsPage() {
  const [access, setAccess] = useState<AdminAccessState>("loading");
  const [accountEmail, setAccountEmail] = useState("");
  const [detectedRoles, setDetectedRoles] = useState<string[]>([]);
  const [currentOrigin, setCurrentOrigin] = useState("");
  const [userId, setUserId] = useState("");
  const [items, setItems] = useState<AdminPromotion[]>([]);
  const [listings, setListings] = useState<TargetListing[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [selected, setSelected] = useState<AdminPromotion | null>(null);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | "live" | "scheduled" | "ended" | "hidden">("all");
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadPromotions = useCallback(async () => {
    const supabase = createClient();
    const { data, error: promotionError } = await supabase
      .from("promotions")
      .select(promotionSelect)
      .order("sort_order", { ascending: true })
      .order("starts_at", { ascending: false });
    if (promotionError) throw promotionError;
    const nextItems = ((data ?? []) as unknown as PromotionRow[]).map(fromRow);
    setItems(nextItems);
    setSelected((current) => current?.id ? nextItems.find((item) => item.id === current.id) ?? current : current);
  }, []);

  useEffect(() => {
    let mounted = true;
    const checkAccess = async () => {
      try {
        if (mounted) setCurrentOrigin(window.location.origin);
        const supabase = createClient();
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) {
          if (mounted) setAccess("signed-out");
          return;
        }
        if (mounted) setAccountEmail(authData.user.email ?? "");
        const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", authData.user.id);
        if (roleError) throw roleError;
        const roleNames = (roles ?? []).map((item) => item.role);
        if (mounted) setDetectedRoles(roleNames);
        if (!roleNames.some((role) => promotionRoles.has(role))) {
          if (mounted) setAccess("denied");
          return;
        }
        if (!mounted) return;
        setUserId(authData.user.id);
        setAccess("allowed");

        const [listingResult, categoryResult] = await Promise.all([
          supabase.from("listings").select("id,slug,name_en,kind,status").order("name_en"),
          supabase.from("categories").select(categorySelect).order("level").order("sort_order").order("name_en"),
        ]);
        if (!mounted) return;
        const workspaceErrors: string[] = [];
        if (listingResult.error) workspaceErrors.push(`Listing destinations could not be loaded: ${errorMessage(listingResult.error)}`);
        else setListings((listingResult.data ?? []) as unknown as TargetListing[]);
        if (categoryResult.error) workspaceErrors.push(`Category destinations could not be loaded: ${errorMessage(categoryResult.error)}`);
        else setCategories((categoryResult.data ?? []) as unknown as CategoryRow[]);
        try {
          await loadPromotions();
        } catch (promotionError) {
          workspaceErrors.push(errorMessage(promotionError));
        }
        if (workspaceErrors.length) setError(workspaceErrors.join(" "));
      } catch (caught) {
        if (!mounted) return;
        setError(errorMessage(caught));
        setAccess("error");
      }
    };
    void checkAccess();
    return () => { mounted = false; };
  }, [loadPromotions]);

  useEffect(() => () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
  }, [pendingImage]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (stateFilter !== "all" && statusFor(item) !== stateFilter) return false;
      return !needle || [item.titleEn, item.eyebrowEn, item.descriptionEn].some((value) => value.toLowerCase().includes(needle));
    });
  }, [items, query, stateFilter]);

  const listingOptions = listings.map((item) => ({
    value: item.id,
    label: item.name_en,
    detail: `${item.kind} · ${item.status}`,
    keywords: `${item.name_en} ${item.slug} ${item.kind}`,
  }));
  const categoryOptions = categories.map((item) => ({
    value: item.id,
    label: item.name_en,
    detail: categoryLevelLabel(item.level),
    keywords: `${item.name_en} ${item.name_ne ?? ""} ${item.slug}`,
  }));

  function selectPromotion(item: AdminPromotion | null) {
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage(null);
    setNotice("");
    setError("");
    setSelected(item);
  }

  async function chooseImage(file?: File) {
    if (!file) return;
    setError("");
    try {
      const checked = await validateStandardImage(file, {
        width: 1254,
        height: 1254,
        maxBytes: 5 * 1024 * 1024,
        label: "Promotion image",
      });
      if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
      setPendingImage({ file: checked.file, previewUrl: checked.previewUrl });
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function save() {
    if (!selected || !userId) return;
    setError("");
    setNotice("");
    if (!selected.titleEn.trim()) {
      setError("Enter an English promotion title.");
      return;
    }
    if (selected.targetType === "listing" && !selected.targetListingId) {
      setError("Choose the listing this promotion should open.");
      return;
    }
    if (selected.targetType === "category" && !selected.targetCategoryId) {
      setError("Choose the category this promotion should open.");
      return;
    }
    const startsAt = fromDateTimeLocal(selected.startsAt);
    const endsAt = fromDateTimeLocal(selected.endsAt);
    if (!startsAt) {
      setError("Choose when the promotion begins.");
      return;
    }
    if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
      setError("The end time must be later than the start time.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    try {
      const payload = {
        title_en: selected.titleEn.trim(),
        title_ne: selected.titleNe.trim() || null,
        eyebrow_en: selected.eyebrowEn.trim() || null,
        eyebrow_ne: selected.eyebrowNe.trim() || null,
        description_en: selected.descriptionEn.trim() || null,
        description_ne: selected.descriptionNe.trim() || null,
        button_label_en: selected.buttonLabelEn.trim() || "Explore offer",
        button_label_ne: selected.buttonLabelNe.trim() || null,
        target_type: selected.targetType,
        target_listing_id: selected.targetType === "listing" ? selected.targetListingId : null,
        target_category_id: selected.targetType === "category" ? selected.targetCategoryId : null,
        banner_storage_path: selected.bannerStoragePath || null,
        theme: selected.theme,
        show_on_homepage: selected.showOnHomepage,
        show_on_deals_page: selected.showOnDealsPage,
        is_active: selected.active,
        sort_order: selected.sortOrder,
        starts_at: startsAt,
        ends_at: endsAt,
        updated_by: userId,
      };
      const operation = selected.id
        ? supabase.from("promotions").update(payload).eq("id", selected.id).select(promotionSelect).single()
        : supabase.from("promotions").insert({ ...payload, created_by: userId }).select(promotionSelect).single();
      const { data, error: saveError } = await operation;
      if (saveError || !data) throw saveError ?? new Error("The promotion could not be saved.");
      let saved = fromRow(data as unknown as PromotionRow);

      if (pendingImage) {
        const storagePath = `promotions/${saved.id}/${safeStorageName(pendingImage.file)}`;
        const { error: uploadError } = await supabase.storage.from(mediaBucket).upload(storagePath, pendingImage.file, {
          cacheControl: "31536000",
          contentType: pendingImage.file.type,
          upsert: false,
        });
        if (uploadError) throw uploadError;
        const oldPath = saved.bannerStoragePath;
        const { data: updated, error: imageError } = await supabase
          .from("promotions")
          .update({ banner_storage_path: storagePath, updated_by: userId })
          .eq("id", saved.id)
          .select(promotionSelect)
          .single();
        if (imageError || !updated) {
          await supabase.storage.from(mediaBucket).remove([storagePath]);
          throw imageError ?? new Error("The promotion image link could not be saved.");
        }
        saved = fromRow(updated as unknown as PromotionRow);
        if (oldPath && oldPath !== storagePath) await supabase.storage.from(mediaBucket).remove([oldPath]);
      }

      await loadPromotions();
      selectPromotion(saved);
      setNotice(`Promotion saved. It is currently ${statusFor(saved)}.`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!selected?.id || !userId) return;
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: archiveError } = await supabase.from("promotions").update({ is_active: false, updated_by: userId }).eq("id", selected.id);
    setSaving(false);
    if (archiveError) {
      setError(errorMessage(archiveError));
      return;
    }
    await loadPromotions();
    setNotice("Promotion hidden from the storefront. Its record and schedule were preserved.");
  }

  async function removeImage() {
    if (!selected) return;
    if (pendingImage) {
      URL.revokeObjectURL(pendingImage.previewUrl);
      setPendingImage(null);
    }
    if (!selected.id || !selected.bannerStoragePath || !userId) {
      setSelected({ ...selected, bannerStoragePath: "" });
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const oldPath = selected.bannerStoragePath;
    const { error: rowError } = await supabase.from("promotions").update({ banner_storage_path: null, updated_by: userId }).eq("id", selected.id);
    if (!rowError) await supabase.storage.from(mediaBucket).remove([oldPath]);
    setSaving(false);
    if (rowError) {
      setError(errorMessage(rowError));
      return;
    }
    setSelected({ ...selected, bannerStoragePath: "" });
    await loadPromotions();
  }

  const currentImage = pendingImage?.previewUrl || (selected?.bannerStoragePath
    ? createClient().storage.from(mediaBucket).getPublicUrl(selected.bannerStoragePath).data.publicUrl
    : "");

  if (access !== "allowed") {
    return <AdminAccessCard access={access} error={error} email={accountEmail} roles={detectedRoles} origin={currentOrigin} resource="promotions" requirement="the Super Admin or Content & Promotion Manager role" returnTo="/admin/promotions" />;
  }

  return (
    <main className="admin-shell admin-promotions-page">
      <AdminSidebar active="promotions" />
      <section className="admin-main">
        <header className="admin-page-heading">
          <div><p className="eyebrow">Content & promotion manager</p><h1>Promotions</h1><p>Create, schedule and link storefront campaigns without changing website code.</p></div>
          <div className="admin-create-actions"><button type="button" onClick={() => void loadPromotions()}><RefreshCw /> Refresh</button><button className="primary-button" type="button" onClick={() => selectPromotion(emptyPromotion(items))}><Plus /> New promotion</button></div>
        </header>
        {notice ? <div className="admin-notice">{notice}<button type="button" onClick={() => setNotice("")}><X /></button></div> : null}
        {error ? <div className="admin-notice admin-error-notice">{error}<button type="button" onClick={() => setError("")}><X /></button></div> : null}

        <div className="admin-promotion-stats">
          <article><Megaphone /><span><small>Total campaigns</small><strong>{items.length}</strong></span></article>
          <article><Eye /><span><small>Live now</small><strong>{items.filter((item) => statusFor(item) === "live").length}</strong></span></article>
          <article><CalendarDays /><span><small>Scheduled</small><strong>{items.filter((item) => statusFor(item) === "scheduled").length}</strong></span></article>
          <article><Archive /><span><small>Ended / hidden</small><strong>{items.filter((item) => ["ended", "hidden"].includes(statusFor(item))).length}</strong></span></article>
        </div>

        <div className="admin-promotion-layout">
          <aside className="admin-promotion-list-panel">
            <div className="admin-promotion-filters">
              <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search campaigns…" /></label>
              <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value as typeof stateFilter)}><option value="all">All states</option><option value="live">Live</option><option value="scheduled">Scheduled</option><option value="ended">Ended</option><option value="hidden">Hidden</option></select>
            </div>
            <div className="admin-promotion-list">
              {!filtered.length ? <div className="admin-list-empty"><Megaphone /><strong>No matching promotions</strong><span>Create a campaign or change the filter.</span></div> : filtered.map((item) => {
                const state = statusFor(item);
                return <button className={selected?.id === item.id ? "selected" : ""} type="button" key={item.id} onClick={() => selectPromotion(item)}><span><strong>{item.titleEn}</strong><small>{item.eyebrowEn || "Promotion"}</small><em>{item.showOnHomepage ? "Home" : ""}{item.showOnHomepage && item.showOnDealsPage ? " · " : ""}{item.showOnDealsPage ? "Deals" : ""}</em></span><i className={`promotion-status promotion-status-${state}`}>{state}</i></button>;
              })}
            </div>
          </aside>

          <section className="admin-promotion-editor">
            {selected ? (
              <form className="admin-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
                <div className="panel-heading"><div><p className="eyebrow">{selected.id ? "Edit campaign" : "New campaign"}</p><h2>{selected.titleEn || "Untitled promotion"}</h2></div><span className={`promotion-status promotion-status-${statusFor(selected)}`}>{statusFor(selected)}</span></div>
                <div className="form-grid">
                  <label>English title<input value={selected.titleEn} onChange={(event) => setSelected({ ...selected, titleEn: event.target.value })} required placeholder="Campaign headline" /></label>
                  <label>Nepali title<input value={selected.titleNe} onChange={(event) => setSelected({ ...selected, titleNe: event.target.value })} placeholder="नेपाली शीर्षक" /></label>
                  <label>English eyebrow<input value={selected.eyebrowEn} onChange={(event) => setSelected({ ...selected, eyebrowEn: event.target.value })} placeholder="Seasonal offer" /></label>
                  <label>Nepali eyebrow<input value={selected.eyebrowNe} onChange={(event) => setSelected({ ...selected, eyebrowNe: event.target.value })} /></label>
                  <label className="span-two">English description<textarea rows={3} value={selected.descriptionEn} onChange={(event) => setSelected({ ...selected, descriptionEn: event.target.value })} placeholder="A short explanation of the offer" /></label>
                  <label className="span-two">Nepali description<textarea rows={3} value={selected.descriptionNe} onChange={(event) => setSelected({ ...selected, descriptionNe: event.target.value })} /></label>
                  <label>English button text<input value={selected.buttonLabelEn} onChange={(event) => setSelected({ ...selected, buttonLabelEn: event.target.value })} /></label>
                  <label>Nepali button text<input value={selected.buttonLabelNe} onChange={(event) => setSelected({ ...selected, buttonLabelNe: event.target.value })} /></label>
                  <label>Link destination<select value={selected.targetType} onChange={(event) => setSelected({ ...selected, targetType: event.target.value as PromotionTarget, targetListingId: "", targetCategoryId: "" })}><option value="deals">KhetE Deals page</option><option value="listing">A product or service listing</option><option value="category">A category</option></select></label>
                  <label>Colour theme<select value={selected.theme} onChange={(event) => setSelected({ ...selected, theme: event.target.value as PromotionTheme })}>{themes.map((theme) => <option key={theme} value={theme}>{theme[0].toUpperCase() + theme.slice(1)}</option>)}</select></label>
                  {selected.targetType === "listing" ? <div className="form-field span-two"><span>Product or service listing</span><SearchableSelect value={selected.targetListingId} onChange={(value) => setSelected({ ...selected, targetListingId: value })} options={listingOptions} placeholder="Choose a listing" searchPlaceholder="Type a product or service name…" /></div> : null}
                  {selected.targetType === "category" ? <div className="form-field span-two"><span>Category</span><SearchableSelect value={selected.targetCategoryId} onChange={(value) => setSelected({ ...selected, targetCategoryId: value })} options={categoryOptions} placeholder="Choose a category" searchPlaceholder="Type a category name…" /></div> : null}
                  <label>Starts at<input type="datetime-local" value={selected.startsAt} onChange={(event) => setSelected({ ...selected, startsAt: event.target.value })} required /></label>
                  <label>Ends at<input type="datetime-local" value={selected.endsAt} onChange={(event) => setSelected({ ...selected, endsAt: event.target.value })} /><small>Leave blank for no automatic end.</small></label>
                  <label>Sort order<input type="number" value={selected.sortOrder} onChange={(event) => setSelected({ ...selected, sortOrder: Number(event.target.value) || 0 })} /></label>
                </div>

                <div className="admin-promotion-image">
                  <div><strong>Promotion image</strong><p>Optional 1254 × 1254 px master, JPG/PNG/WebP, maximum 5 MB. The full image is preserved.</p></div>
                  <div className="promotion-image-controls">
                    <label className="upload-dropzone"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void chooseImage(event.target.files?.[0])} /><ImagePlus /><span>{currentImage ? "Replace image" : "Choose image"}</span></label>
                    {currentImage ? <div className="promotion-image-preview"><img src={currentImage} alt="Promotion preview" /><button type="button" onClick={() => void removeImage()} disabled={saving}><Trash2 /> Remove</button></div> : null}
                  </div>
                </div>

                <div className="admin-switches">
                  <label><input type="checkbox" checked={selected.showOnHomepage} onChange={(event) => setSelected({ ...selected, showOnHomepage: event.target.checked })} /><span>Show on homepage</span></label>
                  <label><input type="checkbox" checked={selected.showOnDealsPage} onChange={(event) => setSelected({ ...selected, showOnDealsPage: event.target.checked })} /><span>Show on KhetE Deals</span></label>
                  <label><input type="checkbox" checked={selected.active} onChange={(event) => setSelected({ ...selected, active: event.target.checked })} /><span>Campaign enabled</span></label>
                </div>

                <div className="admin-form-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? <LoaderCircle className="admin-spinner" /> : <Save />} {saving ? "Saving…" : "Save promotion"}</button>{selected.id ? <button type="button" onClick={() => void archive()} disabled={saving || !selected.active}><Archive /> Hide campaign</button> : null}</div>
              </form>
            ) : <div className="admin-empty-panel"><Megaphone /><h2>No promotion selected</h2><p>Choose an existing campaign or create a new promotion.</p></div>}
          </section>
        </div>
      </section>
    </main>
  );
}

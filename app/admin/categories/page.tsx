"use client";
/* eslint-disable @next/next/no-img-element -- Admin previews show the original upload before and after Supabase storage. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ChevronDown, ChevronRight, Eye, EyeOff, ImagePlus, LoaderCircle, Plus, Save, Tags, Trash2, X } from "lucide-react";
import { categoryLevelLabel, categoryLevelNumber, categorySelect, slugifyCategory, type CategoryRow } from "@/lib/categories";
import { createClient } from "@/lib/supabase/client";
import { AdminSidebar } from "@/components/admin-sidebar";
import { SearchableSelect } from "@/components/searchable-select";
import { safeStorageName, validateStandardImage } from "@/lib/image-processing";
import { AdminAccessCard, type AdminAccessState } from "@/components/admin-access-card";

type CategoryLevel = "Parent" | "Child" | "Grandchild";

type AdminCategory = {
  id: string;
  slug: string;
  name: string;
  nameNe: string;
  descriptionEn: string;
  descriptionNe: string;
  level: CategoryLevel;
  parentId: string | null;
  iconName: string;
  imageUrl: string;
  bannerUrl: string;
  seoTitle: string;
  seoDescription: string;
  sortOrder: number;
  active: boolean;
  homepage: boolean;
};

const catalogRoles = new Set(["super_admin", "product_inventory_manager"]);
const iconOptions = ["tractor", "sprout", "wheat", "cow", "wrench"];

function fromRow(row: CategoryRow): AdminCategory {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name_en,
    nameNe: row.name_ne ?? "",
    descriptionEn: row.description_en ?? "",
    descriptionNe: row.description_ne ?? "",
    level: categoryLevelLabel(row.level),
    parentId: row.parent_id,
    iconName: row.icon_name ?? "sprout",
    imageUrl: row.image_url ?? "",
    bannerUrl: row.banner_url ?? "",
    seoTitle: row.seo_title ?? "",
    seoDescription: row.seo_description ?? "",
    sortOrder: row.sort_order,
    active: row.is_active,
    homepage: row.show_on_homepage,
  };
}

function emptyCategory(level: CategoryLevel, items: AdminCategory[]): AdminCategory {
  return {
    id: "",
    slug: "",
    name: "",
    nameNe: "",
    descriptionEn: "",
    descriptionNe: "",
    level,
    parentId: null,
    iconName: level === "Parent" ? "sprout" : "",
    imageUrl: "",
    bannerUrl: "",
    seoTitle: "",
    seoDescription: "",
    sortOrder: items.filter((item) => item.level === level).length * 10 + 10,
    active: true,
    homepage: level === "Parent",
  };
}

export default function AdminCategoriesPage() {
  const [access, setAccess] = useState<AdminAccessState>("loading");
  const [accountEmail, setAccountEmail] = useState("");
  const [detectedRoles, setDetectedRoles] = useState<string[]>([]);
  const [currentOrigin, setCurrentOrigin] = useState("");
  const [userId, setUserId] = useState("");
  const [items, setItems] = useState<AdminCategory[]>([]);
  const [selected, setSelected] = useState<AdminCategory | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [visibilitySavingId, setVisibilitySavingId] = useState("");
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string> | null>(null);
  const [pendingIcon, setPendingIcon] = useState<{ file: File; previewUrl: string } | null>(null);

  const loadCategories = useCallback(async () => {
    const supabase = createClient();
    const { data, error: categoryError } = await supabase
      .from("categories")
      .select(categorySelect)
      .order("level", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name_en", { ascending: true });

    if (categoryError) throw categoryError;
    const nextItems = (data as unknown as CategoryRow[]).map(fromRow);
    setItems(nextItems);
    setExpandedCategoryIds((current) => {
      const branches = new Set(nextItems.filter((item) => item.level !== "Grandchild").map((item) => item.id));
      if (current === null) return branches;
      return new Set([...current].filter((id) => branches.has(id)));
    });
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

        const { data: roles, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", authData.user.id);
        if (roleError) throw roleError;
        if (mounted) setDetectedRoles((roles ?? []).map((item) => item.role));
        const permitted = roles?.some((item) => catalogRoles.has(item.role));
        if (!permitted) {
          if (mounted) setAccess("denied");
          return;
        }

        if (!mounted) return;
        setUserId(authData.user.id);
        setAccess("allowed");
        await loadCategories();
      } catch (caught) {
        if (!mounted) return;
        setError(caught instanceof Error ? caught.message : "The admin workspace could not be loaded.");
        setAccess("error");
      }
    };

    void checkAccess();
    return () => { mounted = false; };
  }, [loadCategories]);

  const parents = useMemo(() => items.filter((item) => item.level === "Parent"), [items]);
  const children = (parentId: string) => items.filter((item) => item.parentId === parentId && item.level === "Child");
  const grandchildren = (parentId: string) => items.filter((item) => item.parentId === parentId && item.level === "Grandchild");
  const branchIds = useMemo(() => items.filter((item) => item.level !== "Grandchild").map((item) => item.id), [items]);
  const allBranchesExpanded = branchIds.length > 0 && branchIds.every((id) => expandedCategoryIds?.has(id));
  const validParents = selected?.level === "Child"
    ? parents.filter((item) => item.id !== selected.id)
    : selected?.level === "Grandchild"
      ? items.filter((item) => item.level === "Child" && item.id !== selected.id)
      : [];

  function selectCategory(category: AdminCategory | null) {
    if (pendingIcon) URL.revokeObjectURL(pendingIcon.previewUrl);
    setPendingIcon(null);
    setError("");
    setNotice("");
    setSelected(category);
  }

  function toggleBranch(id: string) {
    setExpandedCategoryIds((current) => {
      const next = new Set(current ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function toggleVisibility(category: AdminCategory) {
    if (!category.id || !userId || visibilitySavingId) return;
    setError("");
    setNotice("");
    setVisibilitySavingId(category.id);
    const nextActive = !category.active;
    const supabase = createClient();
    const { error: visibilityError } = await supabase
      .from("categories")
      .update({ is_active: nextActive, updated_by: userId })
      .eq("id", category.id);
    setVisibilitySavingId("");
    if (visibilityError) {
      setError(visibilityError.message);
      return;
    }
    setItems((current) => current.map((item) => item.id === category.id ? { ...item, active: nextActive } : item));
    setSelected((current) => current?.id === category.id ? { ...current, active: nextActive } : current);
    setNotice(`${category.name} is now ${nextActive ? "shown in" : "hidden from"} menus and the storefront.`);
  }

  function categoryTreeRow(category: AdminCategory, depth: 0 | 1 | 2, hasChildren: boolean) {
    const expanded = expandedCategoryIds?.has(category.id) ?? false;
    return (
      <div className={`category-tree-row tree-depth-${depth} ${category.active ? "is-visible" : "is-hidden"}`}>
        {hasChildren ? <button className="tree-branch-toggle" type="button" aria-label={`${expanded ? "Collapse" : "Expand"} ${category.name}`} aria-expanded={expanded} onClick={() => toggleBranch(category.id)}>{expanded ? <ChevronDown /> : <ChevronRight />}</button> : <span className="tree-branch-spacer" />}
        <button className={`category-tree-select ${selected?.id === category.id ? "selected" : ""}`} type="button" onClick={() => selectCategory(category)}><span>{category.name}</span><em>{category.level}</em></button>
        <button className="category-visibility-toggle" type="button" disabled={visibilitySavingId === category.id} aria-label={`${category.active ? "Hide" : "Show"} ${category.name} in menus and storefront`} title={category.active ? "Hide from menus and storefront" : "Show in menus and storefront"} onClick={() => void toggleVisibility(category)}>{visibilitySavingId === category.id ? <LoaderCircle className="admin-spinner" /> : category.active ? <Eye /> : <EyeOff />}</button>
      </div>
    );
  }

  async function chooseIcon(file?: File) {
    if (!file) return;
    setError("");
    try {
      const checked = await validateStandardImage(file, {
        width: 512,
        height: 512,
        maxBytes: 1024 * 1024,
        acceptedTypes: ["image/png", "image/webp"],
        label: "Category icon",
      });
      if (pendingIcon) URL.revokeObjectURL(pendingIcon.previewUrl);
      setPendingIcon({ file: checked.file, previewUrl: checked.previewUrl });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The category icon could not be prepared.");
    }
  }

  async function save() {
    if (!selected || !userId) return;
    setError("");
    setNotice("");

    const slug = selected.slug || slugifyCategory(selected.name);
    if (!slug) {
      setError("Enter a valid English name or slug.");
      return;
    }
    if (selected.level !== "Parent" && !selected.parentId) {
      setError(`Choose a parent for this ${selected.level.toLowerCase()} category.`);
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const payload = {
      parent_id: selected.level === "Parent" ? null : selected.parentId,
      level: categoryLevelNumber(selected.level),
      slug,
      name_en: selected.name.trim(),
      name_ne: selected.nameNe.trim() || null,
      description_en: selected.descriptionEn.trim() || null,
      description_ne: selected.descriptionNe.trim() || null,
      icon_name: selected.iconName || null,
      image_url: selected.imageUrl.trim() || null,
      banner_url: selected.bannerUrl.trim() || null,
      seo_title: selected.seoTitle.trim() || null,
      seo_description: selected.seoDescription.trim() || null,
      show_on_homepage: selected.level === "Parent" && selected.homepage,
      is_active: selected.active,
      sort_order: selected.sortOrder,
      updated_by: userId,
    };

    const operation = selected.id
      ? supabase.from("categories").update(payload).eq("id", selected.id).select(categorySelect).single()
      : supabase.from("categories").insert({ ...payload, created_by: userId }).select(categorySelect).single();
    const { data, error: saveError } = await operation;
    setSaving(false);

    if (saveError || !data) {
      setError(saveError?.message ?? "The category could not be saved.");
      return;
    }

    let saved = fromRow(data as unknown as CategoryRow);
    if (pendingIcon) {
      const storagePath = `categories/${saved.id}/${safeStorageName(pendingIcon.file)}`;
      const { error: uploadError } = await supabase.storage.from("marketplace-media").upload(storagePath, pendingIcon.file, {
        cacheControl: "31536000",
        contentType: pendingIcon.file.type,
        upsert: false,
      });
      if (uploadError) {
        setError(`Category saved, but its icon was not uploaded: ${uploadError.message}. Run supabase/storage-media.sql once, then try again.`);
      } else {
        const { data: publicUrl } = supabase.storage.from("marketplace-media").getPublicUrl(storagePath);
        const { data: updated, error: iconError } = await supabase
          .from("categories")
          .update({ image_url: publicUrl.publicUrl, updated_by: userId })
          .eq("id", saved.id)
          .select(categorySelect)
          .single();
        if (iconError || !updated) setError(`Category saved, but its icon link was not saved: ${iconError?.message ?? "Unknown error"}`);
        else saved = fromRow(updated as unknown as CategoryRow);
      }
    }
    await loadCategories();
    selectCategory(saved);
    setNotice(pendingIcon ? `${saved.level} category and icon saved to Supabase.` : `${saved.level} category saved to Supabase.`);
  }

  async function archiveSelected() {
    if (!selected?.id || !userId) return;
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: archiveError } = await supabase
      .from("categories")
      .update({ is_active: false, updated_by: userId })
      .eq("id", selected.id);
    setSaving(false);
    if (archiveError) {
      setError(archiveError.message);
      return;
    }
    await loadCategories();
    setNotice("Category archived. Existing records were preserved.");
  }

  if (access !== "allowed") {
    return <AdminAccessCard access={access} error={error} email={accountEmail} roles={detectedRoles} origin={currentOrigin} resource="the catalogue" />;
  }

  return (
    <div className="admin-shell">
      <AdminSidebar active="categories" />
      <main className="admin-main">
        <header className="admin-page-heading">
          <div><p className="eyebrow">Live Supabase catalogue</p><h1>Category management</h1><p>Create and edit parent, child and grandchild categories without changing code.</p></div>
          <div className="admin-create-actions"><button className="primary-button" type="button" onClick={() => selectCategory(emptyCategory("Parent", items))}><Plus /> Parent</button><button type="button" onClick={() => selectCategory(emptyCategory("Child", items))}><Plus /> Child</button><button type="button" onClick={() => selectCategory(emptyCategory("Grandchild", items))}><Plus /> Grandchild</button></div>
        </header>
        {notice ? <div className="admin-notice">{notice}<button type="button" onClick={() => setNotice("")}><X /></button></div> : null}
        {error ? <div className="admin-notice admin-error-notice">{error}<button type="button" onClick={() => setError("")}><X /></button></div> : null}
        <div className="admin-category-layout">
          <section className="category-tree-panel">
            <div className="panel-heading"><div><h2>Category tree</h2><span>{items.filter((item) => item.active).length} shown · {items.filter((item) => !item.active).length} hidden</span></div><div className="panel-heading-actions"><button type="button" onClick={() => setExpandedCategoryIds(allBranchesExpanded ? new Set() : new Set(branchIds))}>{allBranchesExpanded ? "Collapse all" : "Expand all"}</button><button type="button" onClick={() => void loadCategories()}>Refresh</button></div></div>
            <div className="category-tree">{parents.map((parent) => {
              const parentChildren = children(parent.id);
              return <div key={parent.id} className="tree-parent">{categoryTreeRow(parent, 0, parentChildren.length > 0)}{expandedCategoryIds?.has(parent.id) ? parentChildren.map((child) => {
                const childGrandchildren = grandchildren(child.id);
                return <div className="tree-child" key={child.id}>{categoryTreeRow(child, 1, childGrandchildren.length > 0)}{expandedCategoryIds?.has(child.id) ? childGrandchildren.map((grandchild) => <div key={grandchild.id}>{categoryTreeRow(grandchild, 2, false)}</div>) : null}</div>;
              }) : null}</div>;
            })}</div>
          </section>

          <section className="category-edit-panel">
            {selected ? <>
              <div className="panel-heading"><div><p className="eyebrow">{selected.id ? "Edit live record" : "Create category"}</p><h2>{selected.id ? selected.name : `${selected.level} category`}</h2></div><span className="level-pill">{selected.level}</span></div>
              <form className="admin-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
                <div className="form-grid">
                  <label>English name<input value={selected.name} onChange={(event) => setSelected({ ...selected, name: event.target.value })} onBlur={() => !selected.slug && setSelected({ ...selected, slug: slugifyCategory(selected.name) })} placeholder="Category name" required /></label>
                  <label>Nepali name<input value={selected.nameNe} onChange={(event) => setSelected({ ...selected, nameNe: event.target.value })} placeholder="नेपाली नाम" /></label>
                  <label>Slug<input value={selected.slug} onChange={(event) => setSelected({ ...selected, slug: slugifyCategory(event.target.value) })} placeholder="category-url-name" required /></label>
                  <label>Sort order<input type="number" value={selected.sortOrder} onChange={(event) => setSelected({ ...selected, sortOrder: Number(event.target.value) || 0 })} /></label>
                  <label>Category level<select value={selected.level} onChange={(event) => setSelected({ ...selected, level: event.target.value as CategoryLevel, parentId: null, homepage: event.target.value === "Parent" && selected.homepage })}><option>Parent</option><option>Child</option><option>Grandchild</option></select></label>
                  <div className="form-field"><span>Parent category</span><SearchableSelect value={selected.parentId ?? ""} onChange={(value) => setSelected({ ...selected, parentId: value || null })} disabled={selected.level === "Parent"} placeholder={selected.level === "Parent" ? "None — top level" : "Choose a parent"} searchPlaceholder="Type a category name, for example Grains…" options={validParents.map((item) => ({ value: item.id, label: `${item.level} · ${item.name}`, keywords: `${item.name} ${item.nameNe}` }))} /></div>
                  <label>Category icon<select value={selected.iconName} onChange={(event) => setSelected({ ...selected, iconName: event.target.value })}><option value="">Inherit/default</option>{iconOptions.map((icon) => <option value={icon} key={icon}>{icon}</option>)}</select></label>
                  <div className="span-two admin-upload-block">
                    <div><strong>Category icon image</strong><p>Optional custom icon: exactly 512 × 512 px, transparent PNG or WebP, maximum 1 MB.</p></div>
                    <div className="category-icon-upload">
                      <label className="upload-dropzone"><input type="file" accept="image/png,image/webp" onChange={(event) => void chooseIcon(event.target.files?.[0])} /><ImagePlus /><span>{pendingIcon || selected.imageUrl ? "Replace icon" : "Choose icon"}</span></label>
                      {pendingIcon || selected.imageUrl ? <div className="category-icon-preview"><img src={pendingIcon?.previewUrl ?? selected.imageUrl} alt="Category icon preview" /><button type="button" onClick={() => { if (pendingIcon) URL.revokeObjectURL(pendingIcon.previewUrl); setPendingIcon(null); setSelected({ ...selected, imageUrl: "" }); }}><Trash2 /> Remove</button></div> : null}
                    </div>
                  </div>
                  <label className="span-two">English description<textarea rows={3} value={selected.descriptionEn} onChange={(event) => setSelected({ ...selected, descriptionEn: event.target.value })} placeholder="Describe this category" /></label>
                  <label className="span-two">Nepali description<textarea rows={3} value={selected.descriptionNe} onChange={(event) => setSelected({ ...selected, descriptionNe: event.target.value })} placeholder="नेपाली विवरण" /></label>
                  <label className="span-two">Promotional banner URL<input type="url" value={selected.bannerUrl} onChange={(event) => setSelected({ ...selected, bannerUrl: event.target.value })} placeholder="https://…" /></label>
                  <label>SEO title<input value={selected.seoTitle} onChange={(event) => setSelected({ ...selected, seoTitle: event.target.value })} /></label>
                  <label>SEO description<input value={selected.seoDescription} onChange={(event) => setSelected({ ...selected, seoDescription: event.target.value })} /></label>
                </div>
                <div className="admin-switches"><label><input type="checkbox" checked={selected.homepage} disabled={selected.level !== "Parent"} onChange={(event) => setSelected({ ...selected, homepage: event.target.checked })} /><span>Show on homepage</span></label><label><input type="checkbox" checked={selected.active} onChange={(event) => setSelected({ ...selected, active: event.target.checked })} /><span>Show in menus and storefront</span></label></div>
                <div className="admin-form-actions"><button className="primary-button" type="submit" disabled={saving}><Save /> {saving ? "Saving…" : "Save category"}</button>{selected.id ? <button type="button" onClick={() => void archiveSelected()} disabled={saving || !selected.active}><Archive /> Archive</button> : null}</div>
              </form>
            </> : <div className="admin-empty-panel"><Tags /><h2>No category selected</h2><p>Choose Parent, Child or Grandchild to start with empty fields, or click an existing category to edit it.</p></div>}
          </section>
        </div>
      </main>
    </div>
  );
}

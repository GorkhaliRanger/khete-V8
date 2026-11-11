"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileArchive, FileSpreadsheet, Images, LoaderCircle, UploadCloud, XCircle } from "lucide-react";
import { AdminAccessCard, type AdminAccessState } from "@/components/admin-access-card";
import { AdminSidebar } from "@/components/admin-sidebar";
import { categorySelect, type CategoryRow } from "@/lib/categories";
import { BULK_IMAGE_LIMIT, BULK_IMAGE_SIZE, BULK_WORKBOOK_NAME, prepareBulkImport, type PreparedBulkImport } from "@/lib/bulk-import";
import { createClient } from "@/lib/supabase/admin-client";

const catalogRoles = new Set(["super_admin", "product_inventory_manager"]);
const mediaBucket = "marketplace-media";

type ImportStage = "idle" | "reading" | "ready" | "importing" | "complete";

function errorMessage(value: unknown) {
  return value instanceof Error ? value.message : "The bulk import could not be completed.";
}

export default function AdminBulkImportPage() {
  const [access, setAccess] = useState<AdminAccessState>("loading");
  const [accountEmail, setAccountEmail] = useState("");
  const [detectedRoles, setDetectedRoles] = useState<string[]>([]);
  const [currentOrigin, setCurrentOrigin] = useState("");
  const [userId, setUserId] = useState("");
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [prepared, setPrepared] = useState<PreparedBulkImport | null>(null);
  const [packageName, setPackageName] = useState("");
  const [stage, setStage] = useState<ImportStage>("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const checkAccess = useCallback(async () => {
    try {
      setCurrentOrigin(window.location.origin);
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) {
        setAccess("signed-out");
        return;
      }
      setAccountEmail(authData.user.email ?? "");
      const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", authData.user.id);
      if (roleError) throw roleError;
      const roleNames = (roles ?? []).map((item) => item.role);
      setDetectedRoles(roleNames);
      if (!roleNames.some((role) => catalogRoles.has(role))) {
        setAccess("denied");
        return;
      }
      const { data: categoryRows, error: categoryError } = await supabase
        .from("categories")
        .select(categorySelect)
        .order("level")
        .order("sort_order")
        .order("name_en");
      if (categoryError) throw categoryError;
      setUserId(authData.user.id);
      setCategories(categoryRows as unknown as CategoryRow[]);
      setAccess("allowed");
    } catch (caught) {
      setError(errorMessage(caught));
      setAccess("error");
    }
  }, []);

  useEffect(() => {
    // The access check intentionally initializes this client-only admin workspace.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkAccess();
  }, [checkAccess]);

  async function readPackage(file: File) {
    setError("");
    setNotice("");
    setPrepared(null);
    setPackageName(file.name);
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("Choose the complete .zip package, not the Excel workbook by itself.");
      setStage("idle");
      return;
    }
    setStage("reading");
    try {
      const result = await prepareBulkImport(file, categories);
      setPrepared(result);
      setStage("ready");
    } catch (caught) {
      setError(errorMessage(caught));
      setStage("idle");
    }
  }

  async function checkDatabaseConflicts(current: PreparedBulkImport) {
    const supabase = createClient();
    const slugs = current.products.map((product) => product.slug);
    const listingSkus = current.products.map((product) => product.sku).filter((value): value is string => Boolean(value));
    const variantSkus = current.products.flatMap((product) => product.variants.map((variant) => variant.sku)).filter((value): value is string => Boolean(value));
    const messages: string[] = [];

    if (slugs.length) {
      const { data, error: queryError } = await supabase.from("listings").select("slug").in("slug", slugs);
      if (queryError) throw queryError;
      for (const row of data ?? []) messages.push(`Listing slug “${row.slug}” already exists.`);
    }
    if (listingSkus.length) {
      const { data, error: queryError } = await supabase.from("listings").select("sku").in("sku", listingSkus);
      if (queryError) throw queryError;
      for (const row of data ?? []) if (row.sku) messages.push(`Listing SKU “${row.sku}” already exists.`);
    }
    if (variantSkus.length) {
      const { data, error: queryError } = await supabase.from("listing_variants").select("sku").in("sku", variantSkus);
      if (queryError) throw queryError;
      for (const row of data ?? []) if (row.sku) messages.push(`Variant SKU “${row.sku}” already exists.`);
    }
    return messages;
  }

  async function importPackage() {
    if (!prepared || prepared.issues.length || !prepared.products.length || !userId) return;
    setStage("importing");
    setError("");
    setNotice("");
    const supabase = createClient();
    const uploadedPaths: string[] = [];
    const createdListingIds: string[] = [];

    try {
      setProgress("Checking the live catalogue for duplicate slugs and SKUs…");
      const conflicts = await checkDatabaseConflicts(prepared);
      if (conflicts.length) throw new Error(conflicts.slice(0, 8).join(" "));

      for (let index = 0; index < prepared.products.length; index += 1) {
        const product = prepared.products[index];
        setProgress(`Importing ${index + 1} of ${prepared.products.length}: ${product.nameEn}`);
        const now = new Date().toISOString();
        const { data: listing, error: listingError } = await supabase
          .from("listings")
          .insert({
            category_id: product.categoryId,
            kind: product.kind,
            status: product.status,
            slug: product.slug,
            name_en: product.nameEn,
            name_ne: product.nameNe,
            short_description_en: product.shortDescriptionEn,
            short_description_ne: product.shortDescriptionNe,
            description_en: product.descriptionEn,
            description_ne: product.descriptionNe,
            specifications: product.specifications,
            search_keywords: product.searchKeywords,
            sku: product.sku,
            base_price: product.basePrice,
            compare_at_price: null,
            offer_title: product.variants.length ? null : product.offerTitle,
            offer_type: product.variants.length ? null : product.offerType,
            offer_value: product.variants.length ? null : product.offerValue,
            price_label: product.priceLabel,
            unit_label: product.unitLabel,
            available: product.available,
            stock_managed: product.stockManaged,
            featured: product.featured,
            districts: product.districts,
            published_at: product.status === "active" ? now : null,
            created_by: userId,
            updated_by: userId,
          })
          .select("id")
          .single();
        if (listingError) throw listingError;
        createdListingIds.push(listing.id);

        const imageRows = [];
        for (const image of product.images) {
          const storagePath = `listings/${listing.id}/${image.storageFilename}`;
          const { error: uploadError } = await supabase.storage.from(mediaBucket).upload(storagePath, image.file, {
            cacheControl: "31536000",
            contentType: image.file.type,
            upsert: false,
          });
          if (uploadError) throw uploadError;
          uploadedPaths.push(storagePath);
          imageRows.push({
            listing_id: listing.id,
            storage_path: storagePath,
            alt_text_en: image.altTextEn,
            alt_text_ne: image.altTextNe,
            sort_order: image.sortOrder,
            is_primary: image.primary,
          });
        }
        if (imageRows.length) {
          const { error: imageError } = await supabase.from("listing_images").insert(imageRows);
          if (imageError) throw imageError;
        }

        if (product.variants.length) {
          const { error: variantError } = await supabase.from("listing_variants").insert(product.variants.map((variant) => ({
            listing_id: listing.id,
            name_en: variant.nameEn,
            name_ne: variant.nameNe,
            sku: variant.sku,
            price: variant.price,
            compare_at_price: null,
            offer_title: variant.offerTitle,
            offer_type: variant.offerType,
            offer_value: variant.offerValue,
            unit_label: variant.unitLabel,
            stock_quantity: variant.stockQuantity,
            is_active: variant.active,
            sort_order: variant.sortOrder,
          })));
          if (variantError) throw variantError;
        } else if (product.stockManaged) {
          const { error: inventoryError } = await supabase.from("inventory").upsert({
            listing_id: listing.id,
            quantity: product.stockQuantity,
            reserved_quantity: 0,
            low_stock_threshold: product.lowStockThreshold,
            allow_backorder: product.allowBackorder,
          });
          if (inventoryError) throw inventoryError;
        }
      }

      setProgress("");
      setNotice(`${prepared.products.length} product${prepared.products.length === 1 ? "" : "s"} and their images were imported successfully.`);
      setStage("complete");
    } catch (caught) {
      setProgress("Rolling back the incomplete import…");
      if (uploadedPaths.length) await supabase.storage.from(mediaBucket).remove(uploadedPaths);
      if (createdListingIds.length) await supabase.from("listings").delete().in("id", createdListingIds);
      setProgress("");
      setError(`${errorMessage(caught)} No partial products were kept.`);
      setStage("ready");
    }
  }

  const totals = useMemo(() => ({
    products: prepared?.products.length ?? 0,
    variants: prepared?.products.reduce((sum, product) => sum + product.variants.length, 0) ?? 0,
    images: prepared?.products.reduce((sum, product) => sum + product.images.length, 0) ?? 0,
  }), [prepared]);

  if (access !== "allowed") {
    return <AdminAccessCard access={access} error={error} email={accountEmail} roles={detectedRoles} origin={currentOrigin} resource="bulk imports" />;
  }

  return (
    <div className="admin-shell admin-import-page">
      <AdminSidebar active="import" />
      <main className="admin-main">
        <div className="admin-import-header">
          <div>
            <p className="eyebrow">Product & inventory manager</p>
            <h1>Bulk product import</h1>
            <p>Upload one ZIP package. The importer checks the workbook and every image before saving anything.</p>
          </div>
          <div className="admin-import-downloads">
            <Link className="secondary-button" href="/templates/khete-bulk-products-template.xlsx" download><FileSpreadsheet size={18} /> Download Excel template</Link>
            <Link className="secondary-button" href="/templates/khete-bulk-products-sample-package.zip" download><FileArchive size={18} /> Download sample ZIP</Link>
          </div>
        </div>

        <div className="admin-import-steps" aria-label="Bulk import steps">
          <article><strong>1</strong><span>Fill the Excel template</span></article>
          <article><strong>2</strong><span>Add standardized images</span></article>
          <article><strong>3</strong><span>ZIP the workbook and images</span></article>
          <article><strong>4</strong><span>Preview and import</span></article>
        </div>

        <section className="admin-import-guide">
          <div><FileSpreadsheet /><strong>Workbook name</strong><code>{BULK_WORKBOOK_NAME}</code></div>
          <div><Images /><strong>Image standard</strong><span>{BULK_IMAGE_SIZE} × {BULK_IMAGE_SIZE} px, JPG/PNG/WebP, maximum 5 MB</span></div>
          <div><FileArchive /><strong>Image folder</strong><code>images/PRODUCT_REF/PRODUCT_REF-01.jpg</code></div>
          <div><CheckCircle2 /><strong>Per product</strong><span>1–{BULK_IMAGE_LIMIT} images; the first becomes primary if none is marked</span></div>
        </section>

        <section className="admin-import-workspace">
          <div className="admin-import-upload">
            <input
              ref={inputRef}
              type="file"
              accept=".zip,application/zip"
              onChange={(event) => { const file = event.target.files?.[0]; if (file) void readPackage(file); }}
            />
            <button type="button" onClick={() => inputRef.current?.click()} disabled={stage === "reading" || stage === "importing"}>
              {stage === "reading" ? <LoaderCircle className="admin-spinner" /> : <UploadCloud />}
              <strong>{stage === "reading" ? "Reading package…" : "Choose bulk import ZIP"}</strong>
              <span>{packageName || "The ZIP must contain the workbook and its images folder."}</span>
            </button>
          </div>

          {prepared ? (
            <div className="admin-import-preview">
              <div className="admin-import-preview-head">
                <div><p className="eyebrow">Validation preview</p><h2>{packageName}</h2><span>Workbook: {prepared.workbookName}</span></div>
                <div className="admin-import-totals"><span><strong>{totals.products}</strong> Products</span><span><strong>{totals.variants}</strong> Variants</span><span><strong>{totals.images}</strong> Images</span></div>
              </div>

              {prepared.issues.length ? (
                <div className="admin-import-issues">
                  <div><XCircle /><strong>{prepared.issues.length} issue{prepared.issues.length === 1 ? "" : "s"} must be corrected</strong></div>
                  <ol>{prepared.issues.map((item, index) => <li key={`${item.sheet}-${item.row}-${index}`}><b>{item.sheet}{item.row ? ` row ${item.row}` : ""}:</b> {item.message}</li>)}</ol>
                </div>
              ) : (
                <div className="admin-import-valid"><CheckCircle2 /><span><strong>Package ready.</strong> All rows, folders, filenames, dimensions, formats, and file sizes passed validation.</span></div>
              )}

              <div className="admin-import-product-list">
                {prepared.products.map((product) => (
                  <article key={product.productRef}>
                    <div><strong>{product.nameEn}</strong><span>{product.productRef} · {product.categoryName}</span></div>
                    <span>{product.variants.length} variants</span><span>{product.images.length} images</span><span>{product.status}</span>
                  </article>
                ))}
              </div>

              <div className="admin-import-actions">
                <button className="primary-button" type="button" onClick={() => void importPackage()} disabled={Boolean(prepared.issues.length) || stage === "importing" || stage === "complete"}>
                  {stage === "importing" ? <LoaderCircle className="admin-spinner" /> : <UploadCloud size={18} />}
                  {stage === "importing" ? "Importing…" : stage === "complete" ? "Import complete" : `Import ${totals.products} products`}
                </button>
                <Link className="secondary-button" href="/admin/listings">Open listings</Link>
              </div>
            </div>
          ) : null}
        </section>

        {progress ? <div className="admin-import-message"><LoaderCircle className="admin-spinner" /> {progress}</div> : null}
        {notice ? <div className="admin-import-message success"><CheckCircle2 /> {notice}</div> : null}
        {error ? <div className="admin-import-message error"><AlertTriangle /> {error}</div> : null}

        <p className="admin-import-note"><Download size={16} /> Keep the original ZIP as your import record. Existing slugs and SKUs are blocked to prevent accidental duplicates.</p>
      </main>
    </div>
  );
}

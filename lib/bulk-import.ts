import JSZip from "jszip";
import * as XLSX from "xlsx";
import type { ListingType } from "@/data/marketplace";
import type { CategoryRow } from "@/lib/categories";
import type { ListingStatus } from "@/lib/listings";
import type { OfferType } from "@/lib/offers";

export const BULK_WORKBOOK_NAME = "khete-bulk-products.xlsx";
export const BULK_IMAGE_SIZE = 1254;
export const BULK_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const BULK_IMAGE_LIMIT = 8;

type WorkbookRow = Record<string, unknown>;

export type BulkValidationIssue = {
  sheet: string;
  row?: number;
  message: string;
};

export type PreparedBulkVariant = {
  nameEn: string;
  nameNe: string | null;
  sku: string | null;
  price: number;
  offerTitle: string | null;
  offerType: OfferType | null;
  offerValue: number | null;
  unitLabel: string | null;
  stockQuantity: number;
  active: boolean;
  sortOrder: number;
};

export type PreparedBulkImage = {
  file: File;
  filename: string;
  storageFilename: string;
  altTextEn: string | null;
  altTextNe: string | null;
  sortOrder: number;
  primary: boolean;
};

export type PreparedBulkProduct = {
  productRef: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  kind: ListingType;
  status: ListingStatus;
  slug: string;
  nameEn: string;
  nameNe: string | null;
  shortDescriptionEn: string | null;
  shortDescriptionNe: string | null;
  descriptionEn: string | null;
  descriptionNe: string | null;
  specifications: string[];
  searchKeywords: string[];
  sku: string | null;
  basePrice: number | null;
  offerTitle: string | null;
  offerType: OfferType | null;
  offerValue: number | null;
  priceLabel: string | null;
  unitLabel: string | null;
  available: boolean;
  stockManaged: boolean;
  featured: boolean;
  districts: string[];
  stockQuantity: number;
  lowStockThreshold: number;
  allowBackorder: boolean;
  variants: PreparedBulkVariant[];
  images: PreparedBulkImage[];
};

export type PreparedBulkImport = {
  workbookName: string;
  products: PreparedBulkProduct[];
  issues: BulkValidationIssue[];
};

const allowedStatuses = new Set<ListingStatus>(["draft", "active", "inactive", "archived"]);
const allowedOfferTypes = new Set<OfferType>(["amount", "percentage"]);
const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
const mimeByExtension: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function cell(row: WorkbookRow, key: string) {
  const value = row[key];
  return value === null || value === undefined ? "" : String(value).trim();
}

function nullableText(value: string) {
  return value ? value : null;
}

function parseList(value: string) {
  return value.split(/\||\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function parseNumber(value: string, fallback: number | null = null) {
  if (!value) return fallback;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseBoolean(value: string, fallback = false) {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  if (["yes", "true", "1", "y"].includes(normalized)) return true;
  if (["no", "false", "0", "n"].includes(normalized)) return false;
  return null;
}

function productKind(category: CategoryRow, categoriesById: Map<string, CategoryRow>): ListingType {
  let current: CategoryRow | undefined = category;
  while (current?.parent_id) current = categoriesById.get(current.parent_id);
  const value = `${current?.slug ?? ""} ${current?.name_en ?? ""}`.toLowerCase();
  if (value.includes("service")) return "service";
  if (value.includes("rental")) return "rental";
  if (value.includes("livestock")) return "livestock";
  if (value.includes("produce") || value.includes("grocery")) return "produce";
  return "product";
}

function sheetRows(workbook: XLSX.WorkBook, name: string) {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<WorkbookRow>(sheet, { defval: "", raw: false });
}

function extensionOf(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

async function imageDimensions(file: Blob) {
  const bitmap = await createImageBitmap(file);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dimensions;
}

function issue(issues: BulkValidationIssue[], sheet: string, row: number | undefined, message: string) {
  issues.push({ sheet, row, message });
}

function validateNonNegative(
  issues: BulkValidationIssue[],
  sheet: string,
  row: number,
  label: string,
  value: number | null,
) {
  if (value !== null && (!Number.isFinite(value) || value < 0)) {
    issue(issues, sheet, row, `${label} must be a number greater than or equal to 0.`);
  }
}

function validateOffer(
  issues: BulkValidationIssue[],
  sheet: string,
  row: number,
  regularPrice: number | null,
  title: string,
  offerType: string,
  offerValue: number | null,
) {
  const hasAny = Boolean(title || offerType || offerValue !== null);
  if (!hasAny) return;
  if (!title) issue(issues, sheet, row, "offer_caption is required when an offer is entered.");
  if (!allowedOfferTypes.has(offerType as OfferType)) issue(issues, sheet, row, "offer_type must be amount or percentage.");
  if (offerValue === null || !Number.isFinite(offerValue) || offerValue <= 0) issue(issues, sheet, row, "offer_value must be greater than 0.");
  if (regularPrice === null || !Number.isFinite(regularPrice) || regularPrice < 0) issue(issues, sheet, row, "Enter the regular price before adding an offer.");
  if (offerType === "percentage" && offerValue !== null && offerValue > 100) issue(issues, sheet, row, "A percentage offer cannot be higher than 100.");
  if (offerType === "amount" && offerValue !== null && regularPrice !== null && offerValue > regularPrice) issue(issues, sheet, row, "An amount offer cannot be higher than the regular price.");
}

export async function prepareBulkImport(file: File, categories: CategoryRow[]): Promise<PreparedBulkImport> {
  const issues: BulkValidationIssue[] = [];
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    return { workbookName: "", products: [], issues: [{ sheet: "Package", message: "Choose a valid .zip package." }] };
  }

  const usableEntries = Object.values(zip.files).filter((entry) => !entry.dir && !entry.name.startsWith("__MACOSX/"));
  const workbookEntry = usableEntries.find((entry) => entry.name.split("/").pop()?.toLowerCase() === BULK_WORKBOOK_NAME.toLowerCase())
    ?? usableEntries.find((entry) => entry.name.toLowerCase().endsWith(".xlsx"));
  if (!workbookEntry) {
    return { workbookName: "", products: [], issues: [{ sheet: "Package", message: `The ZIP must contain ${BULK_WORKBOOK_NAME}.` }] };
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(await workbookEntry.async("arraybuffer"), { type: "array" });
  } catch {
    return { workbookName: workbookEntry.name, products: [], issues: [{ sheet: "Workbook", message: "The Excel workbook could not be read." }] };
  }

  const productRows = sheetRows(workbook, "Products");
  const variantRows = sheetRows(workbook, "Variants");
  const imageRows = sheetRows(workbook, "Images");
  if (!workbook.Sheets.Products) issue(issues, "Products", undefined, "The Products sheet is missing.");
  if (!workbook.Sheets.Variants) issue(issues, "Variants", undefined, "The Variants sheet is missing.");
  if (!workbook.Sheets.Images) issue(issues, "Images", undefined, "The Images sheet is missing.");
  if (!productRows.length) issue(issues, "Products", undefined, "Add at least one product row.");

  const categoryBySlug = new Map(categories.map((category) => [category.slug.toLowerCase(), category]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const products = new Map<string, PreparedBulkProduct>();
  const seenSlugs = new Set<string>();
  const seenSkus = new Set<string>();

  productRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const productRef = cell(row, "product_ref").toUpperCase();
    const categorySlug = cell(row, "category_slug").toLowerCase();
    const nameEn = cell(row, "english_name");
    const slug = cell(row, "slug").toLowerCase();
    const sku = cell(row, "sku");
    const category = categoryBySlug.get(categorySlug);
    const statusValue = (cell(row, "status") || "draft").toLowerCase() as ListingStatus;
    const enteredBasePrice = parseNumber(cell(row, "base_price_npr"));
    let basePrice = enteredBasePrice;
    const compareAtPrice = parseNumber(cell(row, "compare_at_price_npr"));
    let offerTitle = cell(row, "offer_caption");
    let offerType = cell(row, "offer_type").toLowerCase();
    let offerValue = parseNumber(cell(row, "offer_value"));
    if (!offerTitle && !offerType && offerValue === null && compareAtPrice !== null && basePrice !== null && compareAtPrice > basePrice) {
      offerTitle = "Special offer";
      offerType = "amount";
      offerValue = compareAtPrice - basePrice;
      basePrice = compareAtPrice;
    }
    const stockQuantity = parseNumber(cell(row, "stock_quantity"), 0);
    const lowStockThreshold = parseNumber(cell(row, "low_stock_threshold"), 0);
    const available = parseBoolean(cell(row, "available"), true);
    const stockManaged = parseBoolean(cell(row, "manage_stock"), true);
    const featured = parseBoolean(cell(row, "featured"), false);
    const allowBackorder = parseBoolean(cell(row, "allow_backorder"), false);

    if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(productRef)) issue(issues, "Products", rowNumber, "product_ref must be 3–40 characters using A–Z, 0–9, underscore, or hyphen.");
    if (products.has(productRef)) issue(issues, "Products", rowNumber, `Duplicate product_ref: ${productRef}.`);
    if (!categorySlug) issue(issues, "Products", rowNumber, "category_slug is required.");
    else if (!category) issue(issues, "Products", rowNumber, `Category slug “${categorySlug}” does not exist.`);
    else if (!category.is_active) issue(issues, "Products", rowNumber, `Category “${category.name_en}” is inactive.`);
    if (!nameEn) issue(issues, "Products", rowNumber, "english_name is required.");
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) issue(issues, "Products", rowNumber, "slug is required and must use lowercase letters, numbers, and hyphens.");
    if (seenSlugs.has(slug)) issue(issues, "Products", rowNumber, `Duplicate slug: ${slug}.`);
    if (sku && seenSkus.has(sku.toLowerCase())) issue(issues, "Products", rowNumber, `Duplicate SKU: ${sku}.`);
    if (!allowedStatuses.has(statusValue)) issue(issues, "Products", rowNumber, "status must be draft, active, inactive, or archived.");
    validateNonNegative(issues, "Products", rowNumber, "base_price_npr", basePrice);
    validateNonNegative(issues, "Products", rowNumber, "compare_at_price_npr", compareAtPrice);
    validateOffer(issues, "Products", rowNumber, basePrice, offerTitle, offerType, offerValue);
    validateNonNegative(issues, "Products", rowNumber, "stock_quantity", stockQuantity);
    validateNonNegative(issues, "Products", rowNumber, "low_stock_threshold", lowStockThreshold);
    if (compareAtPrice !== null && !cell(row, "offer_caption") && enteredBasePrice !== null && compareAtPrice <= enteredBasePrice) issue(issues, "Products", rowNumber, "compare_at_price_npr must be greater than base_price_npr.");
    if (available === null || stockManaged === null || featured === null || allowBackorder === null) issue(issues, "Products", rowNumber, "Boolean fields must use Yes or No.");

    if (productRef && category) {
      products.set(productRef, {
        productRef,
        categoryId: category.id,
        categorySlug,
        categoryName: category.name_en,
        kind: productKind(category, categoryById),
        status: allowedStatuses.has(statusValue) ? statusValue : "draft",
        slug,
        nameEn,
        nameNe: nullableText(cell(row, "nepali_name")),
        shortDescriptionEn: nullableText(cell(row, "short_description_en")),
        shortDescriptionNe: nullableText(cell(row, "short_description_ne")),
        descriptionEn: nullableText(cell(row, "description_en")),
        descriptionNe: nullableText(cell(row, "description_ne")),
        specifications: parseList(cell(row, "specifications")),
        searchKeywords: parseList(cell(row, "search_keywords")),
        sku: nullableText(sku),
        basePrice: Number.isFinite(basePrice) ? basePrice : null,
        offerTitle: nullableText(offerTitle),
        offerType: allowedOfferTypes.has(offerType as OfferType) ? offerType as OfferType : null,
        offerValue: Number.isFinite(offerValue) ? offerValue : null,
        priceLabel: nullableText(cell(row, "price_label")),
        unitLabel: nullableText(cell(row, "unit_label")),
        available: available ?? true,
        stockManaged: stockManaged ?? true,
        featured: featured ?? false,
        districts: parseList(cell(row, "districts")),
        stockQuantity: Number.isFinite(stockQuantity) ? (stockQuantity ?? 0) : 0,
        lowStockThreshold: Number.isFinite(lowStockThreshold) ? (lowStockThreshold ?? 0) : 0,
        allowBackorder: allowBackorder ?? false,
        variants: [],
        images: [],
      });
      seenSlugs.add(slug);
      if (sku) seenSkus.add(sku.toLowerCase());
    }
  });

  variantRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const productRef = cell(row, "product_ref").toUpperCase();
    const product = products.get(productRef);
    const nameEn = cell(row, "variant_name_en");
    const sku = cell(row, "variant_sku");
    const enteredPrice = parseNumber(cell(row, "selling_price_npr"));
    let price = enteredPrice;
    const compareAtPrice = parseNumber(cell(row, "compare_at_price_npr"));
    let offerTitle = cell(row, "offer_caption");
    let offerType = cell(row, "offer_type").toLowerCase();
    let offerValue = parseNumber(cell(row, "offer_value"));
    if (!offerTitle && !offerType && offerValue === null && compareAtPrice !== null && price !== null && compareAtPrice > price) {
      offerTitle = "Special offer";
      offerType = "amount";
      offerValue = compareAtPrice - price;
      price = compareAtPrice;
    }
    const stockQuantity = parseNumber(cell(row, "stock_quantity"), 0);
    const active = parseBoolean(cell(row, "is_active"), true);
    const sortOrder = parseNumber(cell(row, "sort_order"), index + 1);
    if (!product) issue(issues, "Variants", rowNumber, `Unknown product_ref: ${productRef || "(blank)"}.`);
    if (!nameEn) issue(issues, "Variants", rowNumber, "variant_name_en is required.");
    if (product?.variants.some((variant) => variant.nameEn.toLowerCase() === nameEn.toLowerCase())) issue(issues, "Variants", rowNumber, `Duplicate variant name “${nameEn}” for ${productRef}.`);
    if (sku && seenSkus.has(sku.toLowerCase())) issue(issues, "Variants", rowNumber, `Duplicate SKU: ${sku}.`);
    if (price === null || !Number.isFinite(price) || price < 0) issue(issues, "Variants", rowNumber, "selling_price_npr is required and must be 0 or more.");
    validateNonNegative(issues, "Variants", rowNumber, "compare_at_price_npr", compareAtPrice);
    validateOffer(issues, "Variants", rowNumber, price, offerTitle, offerType, offerValue);
    validateNonNegative(issues, "Variants", rowNumber, "stock_quantity", stockQuantity);
    validateNonNegative(issues, "Variants", rowNumber, "sort_order", sortOrder);
    if (compareAtPrice !== null && !cell(row, "offer_caption") && enteredPrice !== null && compareAtPrice <= enteredPrice) issue(issues, "Variants", rowNumber, "compare_at_price_npr must be greater than selling_price_npr.");
    if (active === null) issue(issues, "Variants", rowNumber, "is_active must use Yes or No.");
    if (product && nameEn && price !== null && Number.isFinite(price)) {
      product.variants.push({
        nameEn,
        nameNe: nullableText(cell(row, "variant_name_ne")),
        sku: nullableText(sku),
        price,
        offerTitle: nullableText(offerTitle),
        offerType: allowedOfferTypes.has(offerType as OfferType) ? offerType as OfferType : null,
        offerValue: Number.isFinite(offerValue) ? offerValue : null,
        unitLabel: nullableText(cell(row, "unit_label")),
        stockQuantity: Number.isFinite(stockQuantity) ? (stockQuantity ?? 0) : 0,
        active: active ?? true,
        sortOrder: Number.isFinite(sortOrder) ? (sortOrder ?? index + 1) : index + 1,
      });
      if (sku) seenSkus.add(sku.toLowerCase());
    }
  });

  const entryByPath = new Map(usableEntries.map((entry) => [entry.name.replace(/^\.\//, "").toLowerCase(), entry]));
  for (let index = 0; index < imageRows.length; index += 1) {
    const row = imageRows[index];
    const rowNumber = index + 2;
    const productRef = cell(row, "product_ref").toUpperCase();
    const product = products.get(productRef);
    const filename = cell(row, "image_file");
    const expectedPath = `images/${productRef}/${filename}`;
    const entry = entryByPath.get(expectedPath.toLowerCase());
    const extension = extensionOf(filename);
    const sortOrder = parseNumber(cell(row, "sort_order"), index + 1);
    const primary = parseBoolean(cell(row, "is_primary"), false);
    if (!product) issue(issues, "Images", rowNumber, `Unknown product_ref: ${productRef || "(blank)"}.`);
    if (!filename) issue(issues, "Images", rowNumber, "image_file is required.");
    if (filename && !new RegExp(`^${productRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-0[1-8]\\.(jpg|jpeg|png|webp)$`, "i").test(filename)) {
      issue(issues, "Images", rowNumber, `Use ${productRef}-01 through ${productRef}-08 as the filename.`);
    }
    if (!allowedExtensions.has(extension)) issue(issues, "Images", rowNumber, "Image must be JPG, PNG, or WebP.");
    if (!entry) issue(issues, "Images", rowNumber, `File not found at ${expectedPath}.`);
    if (primary === null) issue(issues, "Images", rowNumber, "is_primary must use Yes or No.");
    validateNonNegative(issues, "Images", rowNumber, "sort_order", sortOrder);
    if (product && product.images.length >= BULK_IMAGE_LIMIT) issue(issues, "Images", rowNumber, `${productRef} has more than ${BULK_IMAGE_LIMIT} images.`);
    if (!product || !entry || !filename || !allowedExtensions.has(extension)) continue;

    const bytes = await entry.async("uint8array");
    if (bytes.byteLength > BULK_IMAGE_MAX_BYTES) issue(issues, "Images", rowNumber, `${filename} is larger than 5 MB.`);
    // Copy into a plain ArrayBuffer so the browser Blob type cannot inherit a
    // SharedArrayBuffer-compatible generic from JSZip's Uint8Array.
    const imageBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(imageBuffer).set(bytes);
    const blob = new Blob([imageBuffer], { type: mimeByExtension[extension] });
    try {
      const dimensions = await imageDimensions(blob);
      if (dimensions.width !== BULK_IMAGE_SIZE || dimensions.height !== BULK_IMAGE_SIZE) {
        issue(issues, "Images", rowNumber, `${filename} is ${dimensions.width}×${dimensions.height}; it must be exactly ${BULK_IMAGE_SIZE}×${BULK_IMAGE_SIZE}.`);
      }
    } catch {
      issue(issues, "Images", rowNumber, `${filename} is not a readable image.`);
    }
    product.images.push({
      file: new File([imageBuffer], filename, { type: mimeByExtension[extension] }),
      filename,
      storageFilename: filename.toUpperCase().replace(/\.JPEG$/, ".JPG"),
      altTextEn: nullableText(cell(row, "alt_text_en")),
      altTextNe: nullableText(cell(row, "alt_text_ne")),
      sortOrder: Number.isFinite(sortOrder) ? (sortOrder ?? index + 1) : index + 1,
      primary: primary ?? false,
    });
  }

  for (const product of products.values()) {
    if (!product.images.length) issue(issues, "Images", undefined, `${product.productRef} must have at least one image.`);
    const primaryCount = product.images.filter((image) => image.primary).length;
    if (primaryCount > 1) issue(issues, "Images", undefined, `${product.productRef} has more than one primary image.`);
    if (primaryCount === 0 && product.images[0]) product.images[0].primary = true;
    if (product.variants.length) {
      const lowest = Math.min(...product.variants.map((variant) => variant.price));
      product.basePrice = lowest;
    } else if (product.basePrice === null) {
      issue(issues, "Products", undefined, `${product.productRef} needs base_price_npr or at least one variant.`);
    }
  }

  return { workbookName: workbookEntry.name, products: [...products.values()], issues };
}

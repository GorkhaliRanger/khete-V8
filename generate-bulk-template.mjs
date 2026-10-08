import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const ROOT = "/workspace/scratch/7498936e36ca";
const PUBLIC_DIR = path.join(ROOT, "public", "templates");
const BUILD_DIR = path.join(ROOT, "bulk-import-assets");
const SAMPLE_DIR = path.join(BUILD_DIR, "sample-package");
const OUTPUT_DIR = path.join(ROOT, "outputs", "khete-offers-20260723");

const green = "#0B5A35";
const darkGreen = "#123B29";
const paleGreen = "#EAF5EC";
const yellow = "#F4B41A";
const cream = "#FFF9EA";
const line = "#D8E4D9";
const text = "#1B2B21";

const productHeaders = [
  "product_ref", "category_slug", "english_name", "nepali_name", "slug", "sku", "status",
  "short_description_en", "short_description_ne", "description_en", "description_ne", "specifications",
  "search_keywords", "base_price_npr", "offer_caption", "offer_type", "offer_value", "price_label", "unit_label", "available",
  "manage_stock", "featured", "districts", "stock_quantity", "low_stock_threshold", "allow_backorder",
];

const variantHeaders = [
  "product_ref", "variant_name_en", "variant_name_ne", "variant_sku", "selling_price_npr",
  "offer_caption", "offer_type", "offer_value", "unit_label", "stock_quantity", "is_active", "sort_order",
];

const imageHeaders = [
  "product_ref", "image_file", "alt_text_en", "alt_text_ne", "sort_order", "is_primary",
];

const categories = [
  ["machinery", "Machinery & Equipment", "Parent"],
  ["produce", "Fresh Produce", "Parent"],
  ["seeds-inputs", "Seeds & Farm Inputs", "Parent"],
  ["livestock", "Livestock", "Parent"],
  ["services", "Services & Rentals", "Parent"],
  ["tractors", "Machinery & Equipment > Tractors", "Child"],
  ["irrigation", "Machinery & Equipment > Irrigation", "Child"],
  ["farm-tools", "Machinery & Equipment > Farm Tools", "Child"],
  ["vegetables", "Fresh Produce > Vegetables", "Child"],
  ["fruits", "Fresh Produce > Fruits", "Child"],
  ["seeds", "Seeds & Farm Inputs > Seeds", "Child"],
  ["soil-nutrition", "Seeds & Farm Inputs > Soil & Nutrition", "Child"],
  ["cattle", "Livestock > Cattle", "Child"],
  ["small-livestock", "Livestock > Small Livestock", "Child"],
  ["equipment-rental", "Services & Rentals > Equipment Rental", "Child"],
  ["farm-services", "Services & Rentals > Farm Services", "Child"],
  ["heavy-duty-tractors", "Machinery & Equipment > Tractors > Heavy-Duty Tractors", "Grandchild"],
  ["power-tillers", "Machinery & Equipment > Tractors > Power Tillers", "Grandchild"],
  ["power-trailers", "Machinery & Equipment > Tractors > Power Trailers", "Grandchild"],
  ["drip-systems", "Machinery & Equipment > Irrigation > Drip Systems", "Grandchild"],
  ["water-pumps", "Machinery & Equipment > Irrigation > Water Pumps", "Grandchild"],
  ["hand-tools", "Machinery & Equipment > Farm Tools > Hand Tools", "Grandchild"],
  ["sprayers", "Machinery & Equipment > Farm Tools > Sprayers", "Grandchild"],
  ["leafy-greens", "Fresh Produce > Vegetables > Leafy Greens", "Grandchild"],
  ["seasonal-vegetables", "Fresh Produce > Vegetables > Seasonal Vegetables", "Grandchild"],
  ["citrus", "Fresh Produce > Fruits > Citrus", "Grandchild"],
  ["orchard-fruits", "Fresh Produce > Fruits > Orchard Fruits", "Grandchild"],
  ["vegetable-seeds", "Seeds & Farm Inputs > Seeds > Vegetable Seeds", "Grandchild"],
  ["grain-seeds", "Seeds & Farm Inputs > Seeds > Grain Seeds", "Grandchild"],
  ["organic-inputs", "Seeds & Farm Inputs > Soil & Nutrition > Organic Inputs", "Grandchild"],
  ["fertilizers", "Seeds & Farm Inputs > Soil & Nutrition > Fertilizers", "Grandchild"],
  ["dairy-cattle", "Livestock > Cattle > Dairy Cattle", "Grandchild"],
  ["calves", "Livestock > Cattle > Calves", "Grandchild"],
  ["goats", "Livestock > Small Livestock > Goats", "Grandchild"],
  ["poultry", "Livestock > Small Livestock > Poultry", "Grandchild"],
  ["tractor-rental", "Services & Rentals > Equipment Rental > Tractor Rental", "Grandchild"],
  ["tool-rental", "Services & Rentals > Equipment Rental > Tool Rental", "Grandchild"],
  ["installation", "Services & Rentals > Farm Services > Installation", "Grandchild"],
  ["field-support", "Services & Rentals > Farm Services > Field Support", "Grandchild"],
];

const requiredProducts = new Set([
  "product_ref", "category_slug", "english_name", "slug", "sku", "status", "short_description_en",
  "description_en", "base_price_npr", "unit_label", "available", "manage_stock", "featured",
  "stock_quantity", "low_stock_threshold", "allow_backorder",
]);
const requiredVariants = new Set(["product_ref", "variant_name_en", "variant_sku", "selling_price_npr", "stock_quantity", "is_active", "sort_order"]);
const requiredImages = new Set(["product_ref", "image_file", "alt_text_en", "sort_order", "is_primary"]);

const columnLetter = (index) => {
  let number = index + 1;
  let result = "";
  while (number > 0) {
    const remainder = (number - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    number = Math.floor((number - 1) / 26);
  }
  return result;
};

function styleHeader(sheet, headers, required) {
  const last = columnLetter(headers.length - 1);
  const header = sheet.getRange(`A1:${last}1`);
  header.values = [headers];
  header.format = {
    fill: green,
    font: { bold: true, color: "#FFFFFF", size: 11 },
    wrapText: true,
    verticalAlignment: "center",
    borders: { preset: "all", style: "thin", color: "#FFFFFF" },
  };
  header.format.rowHeight = 38;
  headers.forEach((name, index) => {
    if (required.has(name)) {
      sheet.getCell(0, index).format.fill = darkGreen;
    }
  });
  sheet.freezePanes.freezeRows(1);
  sheet.showGridLines = false;
  const body = sheet.getRange(`A2:${last}201`);
  body.format = {
    fill: "#FFFFFF",
    font: { color: text, size: 10 },
    borders: { preset: "all", style: "thin", color: line },
    verticalAlignment: "top",
    wrapText: true,
  };
  body.format.rowHeight = 30;
}

function setWidths(sheet, widths) {
  widths.forEach((width, index) => {
    sheet.getRange(`${columnLetter(index)}:${columnLetter(index)}`).format.columnWidth = width;
  });
}

function addValidations(products, variants, images) {
  products.getRange("G2:G201").dataValidation = { rule: { type: "list", values: ["draft", "active", "archived"] } };
  ["T", "U", "V", "Z"].forEach((col) => {
    products.getRange(`${col}2:${col}201`).dataValidation = { rule: { type: "list", values: ["yes", "no"] } };
  });
  products.getRange("P2:P201").dataValidation = { rule: { type: "list", values: ["amount", "percentage"] } };
  products.getRange("B2:B201").dataValidation = { rule: { type: "list", formula1: "'Category Reference'!$A$2:$A$40" } };
  variants.getRange("G2:G401").dataValidation = { rule: { type: "list", values: ["amount", "percentage"] } };
  variants.getRange("K2:K401").dataValidation = { rule: { type: "list", values: ["yes", "no"] } };
  images.getRange("F2:F1601").dataValidation = { rule: { type: "list", values: ["yes", "no"] } };
}

function buildInstructions(workbook) {
  const sheet = workbook.worksheets.add("Instructions");
  sheet.showGridLines = false;
  sheet.mergeCells("A1:F1");
  sheet.getRange("A1:F1").values = [["khetE bulk product import"]];
  sheet.getRange("A1:F1").format = {
    fill: green,
    font: { bold: true, color: "#FFFFFF", size: 22 },
    verticalAlignment: "center",
  };
  sheet.getRange("A1:F1").format.rowHeight = 48;

  sheet.mergeCells("A2:F2");
  sheet.getRange("A2:F2").values = [["Complete the workbook, place it in a ZIP with the image folders, then upload that ZIP from Admin > Bulk import."]];
  sheet.getRange("A2:F2").format = { fill: paleGreen, font: { color: darkGreen, italic: true }, wrapText: true };
  sheet.getRange("A2:F2").format.rowHeight = 36;

  sheet.getRange("A4:B4").values = [["Package structure", "Required location"]];
  sheet.getRange("A4:B4").format = { fill: darkGreen, font: { bold: true, color: "#FFFFFF" } };
  sheet.getRange("A5:B8").values = [
    ["Workbook", "khete-bulk-products.xlsx"],
    ["First image", "images/PRODUCT_REF/PRODUCT_REF-01.jpg"],
    ["Additional images", "images/PRODUCT_REF/PRODUCT_REF-02.jpg through -08.jpg"],
    ["Upload file", "One .zip containing the workbook and images folder"],
  ];

  sheet.getRange("A10:C10").values = [["Rule", "Requirement", "Why"]];
  sheet.getRange("A10:C10").format = { fill: darkGreen, font: { bold: true, color: "#FFFFFF" } };
  sheet.getRange("A11:C21").values = [
    ["Product reference", "3–40 uppercase letters, numbers, hyphen or underscore", "Connects Products, Variants and Images rows"],
    ["Image dimensions", "Exactly 1254 × 1254 pixels", "Keeps every storefront card and gallery uniform"],
    ["Image type", "JPG, PNG or WebP", "Supported browser formats"],
    ["Image size", "Maximum 5 MB each", "Keeps uploads and pages fast"],
    ["Image count", "1–8 images per product", "At least one image is mandatory"],
    ["Primary image", "One row marked yes, or the first image becomes primary", "Used on cards and search results"],
    ["Variants", "Optional; add one row per selectable option", "Each option gets its own SKU, price and stock"],
    ["Named offers", "Caption + amount or percentage", "Shows a meaningful offer name and calculates the customer price"],
    ["Nepali fields", "Optional for the initial English catalogue", "Can be completed later"],
    ["Category slug", "Choose an active slug from Category Reference", "Connects the listing to the correct category"],
    ["Validation", "The entire ZIP is checked before records are created", "Prevents partial imports"],
  ];

  sheet.getRange("E4:F4").values = [["Workbook sheet", "Purpose"]];
  sheet.getRange("E4:F4").format = { fill: yellow, font: { bold: true, color: darkGreen } };
  sheet.getRange("E5:F9").values = [
    ["Products", "One row per main product/listing"],
    ["Variants", "Optional selectable options under a product"],
    ["Images", "Image file references and order"],
    ["Category Reference", "Valid seed category slugs"],
    ["Instructions", "Packaging and validation rules"],
  ];

  sheet.getRange("A23:F23").merge();
  sheet.getRange("A23:F23").values = [["Do not rename worksheets or column headers. Required fields use the darker green header. Blank template rows contain no sample products."]];
  sheet.getRange("A23:F23").format = { fill: cream, font: { bold: true, color: darkGreen }, wrapText: true };
  sheet.getRange("A23:F23").format.rowHeight = 34;

  sheet.getRange("A4:F23").format.borders = { preset: "all", style: "thin", color: line };
  sheet.getRange("A5:F23").format.wrapText = true;
  setWidths(sheet, [24, 58, 45, 4, 24, 50]);
  sheet.freezePanes.freezeRows(2);
}

function buildCategoryReference(workbook) {
  const sheet = workbook.worksheets.add("Category Reference");
  sheet.showGridLines = false;
  sheet.getRange("A1:C1").values = [["category_slug", "category_path", "level"]];
  sheet.getRange("A1:C1").format = { fill: green, font: { bold: true, color: "#FFFFFF" }, borders: { preset: "all", style: "thin", color: "#FFFFFF" } };
  sheet.getRange(`A2:C${categories.length + 1}`).values = categories;
  sheet.getRange(`A2:C${categories.length + 1}`).format = { borders: { preset: "all", style: "thin", color: line }, font: { color: text }, wrapText: true };
  sheet.getRange(`A2:A${categories.length + 1}`).format.fill = paleGreen;
  sheet.getRange(`A2:A${categories.length + 1}`).format.font = { bold: true, color: green };
  sheet.freezePanes.freezeRows(1);
  setWidths(sheet, [27, 70, 18]);
}

function createWorkbook(sample = false) {
  const workbook = Workbook.create();
  buildInstructions(workbook);

  const products = workbook.worksheets.add("Products");
  styleHeader(products, productHeaders, requiredProducts);
  setWidths(products, [18, 24, 30, 28, 28, 20, 14, 38, 38, 58, 58, 48, 38, 18, 30, 18, 18, 20, 16, 14, 16, 14, 30, 18, 20, 20]);
  products.getRange("N2:N201").format.numberFormat = "#,##0.00";
  products.getRange("Q2:Q201").format.numberFormat = "#,##0.00";
  products.getRange("X2:Y201").format.numberFormat = "0";

  const variants = workbook.worksheets.add("Variants");
  styleHeader(variants, variantHeaders, requiredVariants);
  setWidths(variants, [18, 30, 28, 24, 22, 30, 18, 18, 18, 18, 14, 14]);
  variants.getRange("E2:E401").format.numberFormat = "#,##0.00";
  variants.getRange("H2:H401").format.numberFormat = "#,##0.00";
  variants.getRange("J2:J401").format.numberFormat = "0";

  const images = workbook.worksheets.add("Images");
  styleHeader(images, imageHeaders, requiredImages);
  setWidths(images, [18, 48, 40, 36, 14, 16]);
  images.getRange("E2:E1601").format.numberFormat = "0";

  buildCategoryReference(workbook);
  addValidations(products, variants, images);

  if (sample) {
    products.getRange(`A2:${columnLetter(productHeaders.length - 1)}2`).values = [[
      "CARP-HATCH", "small-livestock", "Carp Hatchlings", "कार्प माछाका भुरा", "carp-hatchlings", "CARP-HATCH-BASE", "active",
      "Healthy carp hatchlings supplied for managed pond stocking.", "व्यवस्थित पोखरीका लागि स्वस्थ कार्प माछाका भुरा।",
      "A selectable mixed carp hatchling listing. Choose one or several species, set the quantity for each, and add them to the cart as separate line items.",
      "रोहु, नैनी, कमन कार्प, ग्रास कार्प, भाकुर, सिल्भर कार्प, बिगहेड र बाटा प्रजाति छुट्टाछुट्टै छनोट गर्न मिल्ने।",
      "Age: hatchling | Packing: oxygenated bag | Handling: live aquatic stock",
      "carp hatchlings rohu naini common grass bhakur silver bighead bata fish fry", 3, "", "", "", "From NPR 2.50", "per hatchling", "yes",
      "yes", "yes", "Kathmandu, Lalitpur, Bhaktapur", 8000, 500, "no",
    ]];

    const variantNames = [
      ["Rohu", "रोहु", "CARP-ROHU", 3, "Pond Stocking Offer", "amount", 0.5, "per hatchling", 1000, "yes", 1],
      ["Naini", "नैनी", "CARP-NAINI", 3.25, "Pond Stocking Offer", "amount", 0.5, "per hatchling", 1000, "yes", 2],
      ["Common Carp", "कमन कार्प", "CARP-COMMON", 3.5, "Pond Stocking Offer", "amount", 0.5, "per hatchling", 1000, "yes", 3],
      ["Grass Carp", "ग्रास कार्प", "CARP-GRASS", 3.75, "Pond Stocking Offer", "amount", 0.5, "per hatchling", 1000, "yes", 4],
      ["Bhakur", "भाकुर", "CARP-BHAKUR", 4, "Pond Stocking Offer", "amount", 0.5, "per hatchling", 1000, "yes", 5],
      ["Silver Carp", "सिल्भर कार्प", "CARP-SILVER", 3.75, "Pond Stocking Offer", "amount", 0.5, "per hatchling", 1000, "yes", 6],
      ["Bighead", "बिगहेड", "CARP-BIGHEAD", 4.25, "Pond Stocking Offer", "amount", 0.5, "per hatchling", 1000, "yes", 7],
      ["Bata", "बाटा", "CARP-BATA", 3.25, "Pond Stocking Offer", "amount", 0.5, "per hatchling", 1000, "yes", 8],
    ];
    variants.getRange("A2:L9").values = variantNames.map((row) => ["CARP-HATCH", ...row]);

    images.getRange("A2:F2").values = [[
      "CARP-HATCH", "images/CARP-HATCH/CARP-HATCH-01.png", "Carp hatchlings in a clean round dish", "सफा गोलो भाँडामा कार्प माछाका भुरा", 1, "yes",
    ]];
  }

  return workbook;
}

async function saveWorkbook(workbook, target) {
  const file = await SpreadsheetFile.exportXlsx(workbook);
  await file.save(target);
}

await fs.mkdir(PUBLIC_DIR, { recursive: true });
await fs.mkdir(SAMPLE_DIR, { recursive: true });
await fs.mkdir(OUTPUT_DIR, { recursive: true });

const blank = createWorkbook(false);
const sample = createWorkbook(true);
await saveWorkbook(blank, path.join(OUTPUT_DIR, "khete-bulk-products-template.xlsx"));
await fs.copyFile(path.join(OUTPUT_DIR, "khete-bulk-products-template.xlsx"), path.join(PUBLIC_DIR, "khete-bulk-products-template.xlsx"));
await saveWorkbook(sample, path.join(SAMPLE_DIR, "khete-bulk-products.xlsx"));

const blankPreview = await blank.render({ sheetName: "Instructions", range: "A1:F23", scale: 1.2, format: "png" });
await fs.writeFile(path.join(BUILD_DIR, "template-instructions-preview.png"), new Uint8Array(await blankPreview.arrayBuffer()));
const samplePreview = await sample.render({ sheetName: "Products", range: "A1:H3", scale: 1.15, format: "png" });
await fs.writeFile(path.join(BUILD_DIR, "sample-products-preview.png"), new Uint8Array(await samplePreview.arrayBuffer()));

const verificationRanges = {
  Products: "A1:Z6",
  Variants: "A1:L6",
  Images: "A1:F6",
  "Category Reference": "A1:C40",
};
for (const [sheetName, range] of Object.entries(verificationRanges)) {
  const preview = await blank.render({ sheetName, range, scale: 1, format: "png" });
  const safeName = sheetName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  await fs.writeFile(path.join(BUILD_DIR, `verify-${safeName}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const blankCheck = await blank.inspect({ kind: "region", sheetId: "Products", range: "A1:Z4", maxChars: 7000 });
const sampleCheck = await sample.inspect({ kind: "region", sheetId: "Variants", range: "A1:L10", maxChars: 7000 });
await fs.writeFile(path.join(BUILD_DIR, "verification.txt"), `${blankCheck.ndjson}\n\n${sampleCheck.ndjson}\n`, "utf8");

console.log(JSON.stringify({
  template: path.join(OUTPUT_DIR, "khete-bulk-products-template.xlsx"),
  sampleWorkbook: path.join(SAMPLE_DIR, "khete-bulk-products.xlsx"),
  previews: [path.join(BUILD_DIR, "template-instructions-preview.png"), path.join(BUILD_DIR, "sample-products-preview.png")],
}, null, 2));

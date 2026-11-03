import { Suspense } from "react";
import { ProductCatalog } from "@/components/product-catalog";
import { DealsPromoStrip } from "@/components/deals-promo-strip";
import { CatalogBrowseBar } from "@/components/catalog-browse-bar";

export const metadata = { title: "khetE Deals" };

export default function DealsPage() {
  return <main><Suspense fallback={null}><CatalogBrowseBar /></Suspense><DealsPromoStrip /><Suspense fallback={<div className="site-container page-loading">Loading deals…</div>}><ProductCatalog dealsOnly /></Suspense></main>;
}

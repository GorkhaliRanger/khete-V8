import { Suspense } from "react";
import { ProductCatalog } from "@/components/product-catalog";
import { CatalogBrowseBar } from "@/components/catalog-browse-bar";

export const metadata = { title: "Products" };

export default function ProductsPage() {
  return (
    <main>
      <Suspense fallback={null}><CatalogBrowseBar /></Suspense>
      <Suspense fallback={<div className="site-container page-loading">Loading marketplace…</div>}><ProductCatalog /></Suspense>
    </main>
  );
}

import { Suspense } from "react";
import { ProductCatalog } from "@/components/product-catalog";
import { CategoryRail } from "@/components/category-rail";

export const metadata = { title: "Products" };

export default function ProductsPage() {
  return (
    <main>
      <section className="page-banner products-banner"><div className="site-container"><p className="eyebrow">Products, produce and farm essentials</p><h1>The Complete Marketplace for You and Your Farm</h1><p>Browse every category, then narrow the available listings with the filters.</p></div></section>
      <CategoryRail />
      <Suspense fallback={<div className="site-container page-loading">Loading marketplace…</div>}><ProductCatalog /></Suspense>
    </main>
  );
}

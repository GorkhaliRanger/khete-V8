import { Suspense } from "react";
import { ProductCatalog } from "@/components/product-catalog";
import { BrandName } from "@/components/brand-name";
import { PromotionShowcase } from "@/components/promotion-showcase";

export const metadata = { title: "khetE Deals" };

export default function DealsPage() {
  return <main><section className="page-banner deals-banner"><div className="site-container"><p className="eyebrow">Limited-time value</p><h1><BrandName /> Deals</h1><p>Seasonal offers, useful bundles and promotional prices chosen by the <BrandName /> team.</p></div></section><PromotionShowcase placement="deals" /><Suspense fallback={<div className="site-container page-loading">Loading deals…</div>}><ProductCatalog dealsOnly /></Suspense></main>;
}

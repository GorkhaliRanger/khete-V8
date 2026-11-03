import { Suspense } from "react";
import { ProductCatalog } from "@/components/product-catalog";
import { CatalogBrowseBar } from "@/components/catalog-browse-bar";
import { ProfessionalServiceMarketplace } from "@/components/professional-service-marketplace";

export const metadata = { title: "Services & Rentals" };

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>;
}) {
  const { provider = "" } = await searchParams;
  return (
    <main>
      <Suspense fallback={null}>
        <CatalogBrowseBar />
      </Suspense>
      <Suspense fallback={<div className="site-container page-loading">Loading services…</div>}>
        <ProductCatalog servicesOnly />
      </Suspense>
      <ProfessionalServiceMarketplace initialProviderId={provider} />
    </main>
  );
}

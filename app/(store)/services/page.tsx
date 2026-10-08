import { Suspense } from "react";
import { CategoryRail } from "@/components/category-rail";
import { ProductCatalog } from "@/components/product-catalog";
import { ProfessionalServiceMarketplace } from "@/components/professional-service-marketplace";
import Link from "next/link";
import { ArrowRight, UsersRound } from "lucide-react";

export const metadata = { title: "Services & Rentals" };

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>;
}) {
  const { provider = "" } = await searchParams;
  return (
    <main>
      <section className="page-banner services-banner">
        <div className="site-container">
          <p className="eyebrow">Practical support for agriculture</p>
          <h1>Services & Rentals for You and Your Farm</h1>
          <p>Find equipment rentals, installation support and dependable agricultural services.</p>
        </div>
      </section>
      <section className="expert-service-callout"><div className="site-container"><div><UsersRound /><span><strong>Need professional guidance?</strong><small>Book verified advisors, technical experts and associate partners.</small></span></div><Link className="secondary-button" href="#professional-services">Book a professional <ArrowRight /></Link></div></section>
      <ProfessionalServiceMarketplace initialProviderId={provider} />
      <CategoryRail mode="services" />
      <Suspense fallback={<div className="site-container page-loading">Loading services…</div>}><ProductCatalog servicesOnly /></Suspense>
    </main>
  );
}

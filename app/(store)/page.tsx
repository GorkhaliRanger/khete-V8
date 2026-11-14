import Link from "next/link";
import { ArrowRight, BadgeCheck, BookOpen, Leaf, MapPin, PackageCheck, Quote, Truck } from "lucide-react";
import { HomeCategoryGrid } from "@/components/home-category-grid";
import { IntroGate } from "@/components/intro-gate";
import { BrandName } from "@/components/brand-name";
import { HomeDealsSection, HomeListingSections } from "@/components/home-listing-rows";
import { ProfessionalNetworkPreview } from "@/components/professional-network-preview";
import { HomeMarquee } from "@/components/home-marquee";
import { HomeAdBanner } from "@/components/home-ad-banner";

export default function HomePage() {
  return (
    <main className="home-page">
      <IntroGate />
      <HomeMarquee />
      <section className="home-hero">
        <div className="site-container hero-layout">
          <div className="hero-copy">
            <p className="eyebrow">Nepal&apos;s connected agriculture marketplace</p>
            <h1>Find what your farm needs. <em>Grow what comes next.</em></h1>
            <p>Fresh produce, reliable equipment, useful services and verified agricultural connections—brought together by <BrandName />.</p>
            <div className="hero-actions"><Link className="primary-button" href="/products">Explore marketplace <ArrowRight size={18} /></Link><Link className="text-button" href="/our-story">Why <BrandName />?</Link></div>
            <div className="hero-proof"><span><BadgeCheck /> Curated listings</span><span><MapPin /> Selected districts</span><span><Truck /> Flexible delivery</span></div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <span className="sun-disc" />
            <span className="field field-one" />
            <span className="field field-two" />
            <span className="field field-three" />
            <div className="hero-art-card hero-art-main"><Leaf /><strong>Fresh from the field</strong><span>Produce · tools · services</span></div>
            <div className="hero-art-card hero-art-float"><PackageCheck /><strong>Verified supply</strong></div>
          </div>
        </div>
      </section>

      <HomeDealsSection />

      <section className="home-section category-section">
        <div className="site-container">
          <div className="section-heading"><div><p className="eyebrow">Shop products</p><h2>Start with what you need.</h2><p>Browse selected parent categories here, or open the complete category directory.</p></div><Link className="text-button" href="/products?categories=all#all-categories">Explore all categories <ArrowRight size={17} /></Link></div>
          <HomeCategoryGrid />
        </div>
      </section>

      <HomeListingSections />

      <section className="home-section experts-preview-section">
        <div className="site-container">
          <div className="section-heading"><div><p className="eyebrow">Experts & Partners</p><h2>Experience you can explore and trust.</h2><p>Meet advisors, specialist professionals and associate organisations working across agriculture.</p></div><Link className="text-button" href="/experts">View the full network <ArrowRight size={17} /></Link></div>
          <div className="experts-preview-layout">
            <div className="experts-preview-photo">
              <img src="/experts/experts-partners.png" alt="A khetE agricultural advisor reviewing crops together with a farmer in the field" />
              <span className="experts-preview-photo-tag"><BadgeCheck size={15} /> Verified advisors &amp; partners</span>
            </div>
            <ProfessionalNetworkPreview />
          </div>
        </div>
      </section>

      <HomeAdBanner />

      <div className="site-container trust-grid"><div><BadgeCheck /><strong>Clear listing details</strong><span>Specifications, units and availability</span></div><div><Truck /><strong>Delivery that fits</strong><span><BrandName /> and courier fulfilment</span></div><div><PackageCheck /><strong>Support after ordering</strong><span>Tracking, invoices and returns</span></div></div>

      <section className="home-section stories-section">
        <div className="site-container stories-layout">
          <article className="testimonial-card"><Quote /><blockquote>“The best marketplace should make agricultural buying feel clear, dependable and close to home.”</blockquote><p>— The idea behind <BrandName /></p></article>
          <div className="journal-panel"><p className="eyebrow">From the <BrandName /> journal</p><h2>Practical stories from farms, people and growing businesses.</h2><p>Use this space for collaborations, achievements, field updates and useful agricultural guidance.</p><Link className="primary-button" href="/our-story"><BookOpen size={18} /> Read our story</Link></div>
        </div>
      </section>
    </main>
  );
}

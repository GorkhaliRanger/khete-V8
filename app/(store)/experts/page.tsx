import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { ExpertDirectory } from "@/components/expert-directory";

export const metadata = { title: "Experts & Partners" };

export default function ExpertsPage() {
  return (
    <main>
      <section className="page-banner experts-banner"><div className="site-container network-banner-inner"><div><p className="eyebrow">Knowledge, experience and collaboration</p><h1>Experts & Partners</h1><p>Meet approved agricultural advisors, specialist professionals and associate organisations connected with our marketplace.</p></div><Link className="primary-button" href="/experts/apply">Apply to join <ArrowRight /></Link></div></section>
      <section className="experts-directory">
        <div className="site-container">
          <div className="section-heading"><div><p className="eyebrow">Professional network</p><h2>Find the right experience for the work ahead.</h2><p>Every published profile has completed the khetE application and admin review process.</p></div><span className="network-verified-note"><BadgeCheck /> Admin-approved profiles</span></div>
          <ExpertDirectory />
        </div>
      </section>
    </main>
  );
}

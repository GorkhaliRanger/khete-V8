import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { ExpertDirectory } from "@/components/expert-directory";

export const metadata = { title: "Experts & Partners" };

export default function ExpertsPage() {
  return (
    <main>
      <section className="experts-directory">
        <div className="site-container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Professional network</p>
              <h1>Find the right experience for the work ahead.</h1>
              <p>Meet approved agricultural advisors, specialist professionals and associate organisations. Every published profile has completed the khetE application and admin review process.</p>
            </div>
            <div className="section-heading-actions">
              <span className="network-verified-note"><BadgeCheck /> Admin-approved profiles</span>
              <Link className="primary-button" href="/experts/apply">Apply to join <ArrowRight /></Link>
            </div>
          </div>
          <ExpertDirectory />
        </div>
      </section>
    </main>
  );
}

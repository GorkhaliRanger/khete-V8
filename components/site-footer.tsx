import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { WHATSAPP_CHAT_URL } from "@/lib/contact";
import { BrandName } from "./brand-name";

const groups = [
  { title: "Shop", links: [["Products", "/products"], ["Services & Rentals", "/services"], ["Categories", "/products#all-categories"], ["khetE Deals", "/deals"]] },
  { title: "Customer Service", links: [["Contact & Support", "/support"], ["Order & Delivery Help", "/support?type=order_issue"], ["Returns & Replacements", "/support?type=return_request"], ["Custom Requests", "/support?type=custom_request"]] },
  { title: "Company", links: [["Our Story", "/our-story"], ["Certificates & Verification", "/certificates"], ["Experts & Partners", "/experts"], ["Join Professional Network", "/experts/apply"], ["Projects & Collaborations", "/our-story#projects"]] },
  { title: "Legal", links: [["Terms & Conditions", "/policies/terms"], ["Privacy Policy", "/policies/privacy"], ["Returns & Refunds", "/policies/returns"], ["Delivery Policy", "/policies/delivery"], ["Payment Policy", "/policies/payment"]] },
];

export function SiteFooter() {
  return (
    <footer className="site-footer" id="contact">
      <div className="footer-newsletter-band">
        <div className="site-container footer-newsletter">
          <div><p className="eyebrow">Stay close to the field</p><h2>Useful offers and agricultural updates.</h2></div>
          <form onSubmit={(event) => event.preventDefault()}><label className="sr-only" htmlFor="newsletter-email">Email address</label><input id="newsletter-email" type="email" placeholder="Your email address" /><button type="submit"><span>Subscribe</span><ArrowRight /></button></form>
        </div>
      </div>
      <div className="site-container footer-grid">
        <div className="footer-brand">
          <span className="footer-logo" aria-label="khetE" />
          <p>A growing marketplace for agricultural produce, equipment, services and trusted connections across Nepal.</p>
          <a className="whatsapp-inline" href={WHATSAPP_CHAT_URL} target="_blank" rel="noopener noreferrer"><MessageCircle size={19} aria-hidden="true" /> WhatsApp customer support</a>
        </div>
        {groups.map((group) => (
          <div className="footer-group" key={group.title}>
            <h3>{group.title}</h3>
            {group.links.map(([label, href]) => <Link href={href} key={label}>{label === "khetE Deals" ? <><BrandName /> Deals</> : label}</Link>)}
          </div>
        ))}
      </div>
      <div className="footer-bottom"><div className="site-container"><span>© 2026 <BrandName /> · PAN registered</span><span>Secure payments · English / नेपाली</span></div></div>
    </footer>
  );
}

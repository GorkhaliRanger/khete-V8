import { Award, BadgeCheck, FileText, Link2, ShieldCheck } from "lucide-react";
import {
  CertificateDirectory,
  type CertificateDirectoryItem,
  type CertificateEntitySummary,
} from "@/components/certificate-directory";
import {
  certificateLinkSelect,
  certificateSelect,
  labelCertificateType,
  type Certificate,
  type CertificateLink,
  type CertificateListingTarget,
  type CertificateOfferingTarget,
  type CertificateProfileTarget,
  type CertificateSubject,
} from "@/lib/certificates";
import { createClient } from "@/lib/supabase/server";

type ResolvedLink = CertificateLink & {
  professional_profiles: CertificateProfileTarget | CertificateProfileTarget[] | null;
  listings: CertificateListingTarget | CertificateListingTarget[] | null;
  professional_offerings: CertificateOfferingTarget | CertificateOfferingTarget[] | null;
  certificate_subjects: CertificateSubject | CertificateSubject[] | null;
};

function one<T>(value: T | T[] | null | undefined) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function resolveEntity(link: ResolvedLink): CertificateEntitySummary | null {
  const profile = one(link.professional_profiles);
  if (profile) {
    return {
      id: profile.id,
      type: "profile",
      name: profile.name,
      label: profile.role === "associate_partner" ? "Associate Partner" : profile.role === "advisor" ? "Advisor" : "Expert Professional",
      href: `/experts/${profile.slug}`,
    };
  }
  const listing = one(link.listings);
  if (listing) {
    return {
      id: listing.id,
      type: "listing",
      name: listing.name_en,
      label: labelCertificateType(listing.kind),
      href: `/products/${listing.slug}`,
    };
  }
  const offering = one(link.professional_offerings);
  if (offering) {
    return {
      id: offering.id,
      type: "offering",
      name: offering.title,
      label: "Professional Service",
      href: `/services?provider=${offering.profile_id}#professional-services`,
    };
  }
  const subject = one(link.certificate_subjects);
  if (subject) {
    return {
      id: subject.id,
      type: "subject",
      name: subject.display_name,
      label: subject.kind === "farm" ? "Farm" : "Person",
      href: `/certificates/subjects/${subject.slug}`,
    };
  }
  return null;
}

export default async function CertificatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialTargetId = ["profile", "listing", "offering", "subject"]
    .map((key) => params[key])
    .find((value): value is string => typeof value === "string") ?? "";
  const supabase = await createClient();
  const [{ data: certificateData }, { data: linkData }] = await Promise.all([
    supabase
      .from("certificates")
      .select(certificateSelect)
      .eq("is_public", true)
      .in("status", ["verified", "expired"])
      .order("issued_on", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("certificate_links")
      .select(
        `${certificateLinkSelect},professional_profiles(id,slug,role,name,position_title,organization_name),listings(id,slug,kind,name_en),professional_offerings(id,profile_id,kind,title,professional_profiles(id,slug,name)),certificate_subjects(${[
          "id",
          "kind",
          "slug",
          "display_name",
          "subtitle",
          "location",
          "description",
          "image_url",
          "is_public",
          "created_at",
          "updated_at",
        ].join(",")})`,
      ),
  ]);

  const links = (linkData ?? []) as unknown as ResolvedLink[];
  const entitiesByCertificate = new Map<string, CertificateEntitySummary[]>();
  links.forEach((link) => {
    const entity = resolveEntity(link);
    if (!entity) return;
    const current = entitiesByCertificate.get(link.certificate_id) ?? [];
    current.push(entity);
    entitiesByCertificate.set(link.certificate_id, current);
  });
  const certificates: CertificateDirectoryItem[] = ((certificateData ?? []) as unknown as Certificate[])
    .map((certificate) => ({
      ...certificate,
      entities: entitiesByCertificate.get(certificate.id) ?? [],
    }));

  return (
    <main className="certificates-page">
      <section className="page-banner certificates-banner">
        <div className="site-container">
          <p className="eyebrow"><ShieldCheck /> khetE trust records</p>
          <h1>Certificates & Verification</h1>
          <p>Review certificates linked to agricultural products, rentals, services, farms, people and approved professional profiles.</p>
        </div>
      </section>
      <section className="certificate-explainer">
        <div className="site-container">
          <div className="certificate-explainer-copy">
            <FileText />
            <div><strong>Read the complete record</strong><span>Every published certificate includes its issuer, certificate number, dates, status and either the full uploaded document or a complete text record.</span></div>
          </div>
          <div className="certificate-summary" aria-label="Certificate directory summary">
            <span><Award /><strong>{certificates.length}</strong><small>Published</small></span>
            <span><Link2 /><strong>{links.length}</strong><small>Linked records</small></span>
            <span><BadgeCheck /><strong>Full</strong><small>Document access</small></span>
          </div>
        </div>
      </section>
      <CertificateDirectory certificates={certificates} initialTargetId={initialTargetId} />
    </main>
  );
}

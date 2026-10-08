/* eslint-disable @next/next/no-img-element -- Certificate images can be issued by external authorities. */
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  Building2,
  CalendarDays,
  ExternalLink,
  FileText,
  Link2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  certificateDate,
  certificateLinkSelect,
  certificateSelect,
  labelCertificateStatus,
  labelCertificateType,
  publicCertificateStatus,
  type Certificate,
  type CertificateLink,
  type CertificateListingTarget,
  type CertificateOfferingTarget,
  type CertificateProfileTarget,
  type CertificateSubject,
} from "@/lib/certificates";
import { createClient } from "@/lib/supabase/server";

type DetailLink = CertificateLink & {
  professional_profiles: CertificateProfileTarget | CertificateProfileTarget[] | null;
  listings: CertificateListingTarget | CertificateListingTarget[] | null;
  professional_offerings: CertificateOfferingTarget | CertificateOfferingTarget[] | null;
  certificate_subjects: CertificateSubject | CertificateSubject[] | null;
};

function one<T>(value: T | T[] | null | undefined) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function documentIsImage(certificate: Certificate) {
  return certificate.document_mime_type?.startsWith("image/")
    || /\.(?:jpe?g|png|webp)(?:\?.*)?$/i.test(certificate.document_url ?? "");
}

export default async function CertificateDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: certificateData } = await supabase
    .from("certificates")
    .select(certificateSelect)
    .eq("slug", slug)
    .eq("is_public", true)
    .in("status", ["verified", "expired"])
    .maybeSingle();
  if (!certificateData) notFound();
  const certificate = certificateData as unknown as Certificate;
  const { data: linkData } = await supabase
    .from("certificate_links")
    .select(
      `${certificateLinkSelect},professional_profiles(id,slug,role,name,position_title,organization_name),listings(id,slug,kind,name_en),professional_offerings(id,profile_id,kind,title,professional_profiles(id,slug,name)),certificate_subjects(id,kind,slug,display_name,subtitle,location,description,image_url,is_public,created_at,updated_at)`,
    )
    .eq("certificate_id", certificate.id);
  const links = (linkData ?? []) as unknown as DetailLink[];
  const status = publicCertificateStatus(certificate);

  return (
    <main className="certificate-detail-page">
      <div className="site-container">
        <Link className="back-link" href="/certificates"><ArrowLeft /> Back to Certificates</Link>
        <section className={`certificate-detail-hero certificate-detail-${status}`}>
          <span className={`certificate-seal certificate-seal-${status}`}><Award /></span>
          <div>
            <p className="eyebrow">{labelCertificateType(certificate.certificate_type)} certificate</p>
            <h1>{certificate.title}</h1>
            <p>{certificate.summary}</p>
            <div className="certificate-detail-badges">
              <b className={`certificate-status certificate-status-${status}`}><BadgeCheck /> {labelCertificateStatus(certificate.status, certificate.expires_on)}</b>
              <span><ShieldCheck /> Published verification record</span>
            </div>
          </div>
        </section>

        <div className="certificate-detail-layout">
          <article>
            <section className="certificate-document-section">
              <header>
                <div><p className="eyebrow"><FileText /> Complete certificate</p><h2>Full document</h2></div>
                {certificate.document_url ? (
                  <a className="secondary-button" href={certificate.document_url} target="_blank" rel="noopener noreferrer">
                    Open separately <ExternalLink />
                  </a>
                ) : null}
              </header>
              {certificate.document_url ? (
                documentIsImage(certificate) ? (
                  <a className="certificate-document-image" href={certificate.document_url} target="_blank" rel="noopener noreferrer">
                    <img src={certificate.document_url} alt={`Complete ${certificate.title} certificate`} />
                  </a>
                ) : (
                  <iframe
                    className="certificate-document-frame"
                    src={certificate.document_url}
                    title={`Complete ${certificate.title} certificate`}
                  />
                )
              ) : certificate.full_text ? (
                <div className="certificate-full-text">{certificate.full_text}</div>
              ) : (
                <div className="certificate-document-unavailable">
                  <FileText />
                  <strong>The complete document is being prepared.</strong>
                </div>
              )}
              {certificate.full_text && certificate.document_url ? (
                <details className="certificate-transcript">
                  <summary>Read text record</summary>
                  <div>{certificate.full_text}</div>
                </details>
              ) : null}
            </section>

            <section className="certificate-linked-section">
              <header><p className="eyebrow"><Link2 /> Linked records</p><h2>What this certificate applies to</h2></header>
              {!links.length ? (
                <div className="certificate-unlinked-large"><ShieldCheck /><span><strong>Independent certificate</strong><small>This record is not currently attached to another khetE page.</small></span></div>
              ) : (
                <div className="certificate-detail-links">
                  {links.map((link) => {
                    const profile = one(link.professional_profiles);
                    if (profile) {
                      return <Link href={`/experts/${profile.slug}`} key={link.id}><UserRound /><span><strong>{profile.name}</strong><small>{profile.position_title}</small></span></Link>;
                    }
                    const listing = one(link.listings);
                    if (listing) {
                      return <Link href={`/products/${listing.slug}`} key={link.id}><ShieldCheck /><span><strong>{listing.name_en}</strong><small>{labelCertificateType(listing.kind)}</small></span></Link>;
                    }
                    const offering = one(link.professional_offerings);
                    if (offering) {
                      return <Link href={`/services?provider=${offering.profile_id}#professional-services`} key={link.id}><ShieldCheck /><span><strong>{offering.title}</strong><small>Professional service</small></span></Link>;
                    }
                    const subject = one(link.certificate_subjects);
                    if (subject) {
                      return <Link href={`/certificates/subjects/${subject.slug}`} key={link.id}>{subject.kind === "farm" ? <Building2 /> : <UserRound />}<span><strong>{subject.display_name}</strong><small>{subject.kind === "farm" ? "Farm" : "Person"}</small></span></Link>;
                    }
                    return null;
                  })}
                </div>
              )}
            </section>
          </article>

          <aside>
            <section className="certificate-facts">
              <h2>Certificate details</h2>
              <dl>
                <div><dt>Issuer</dt><dd>{certificate.issuer}</dd></div>
                <div><dt>Certificate number</dt><dd>{certificate.certificate_number}</dd></div>
                <div><dt>Issued on</dt><dd>{certificateDate(certificate.issued_on)}</dd></div>
                <div><dt>Valid from</dt><dd>{certificateDate(certificate.valid_from)}</dd></div>
                <div><dt>Expires on</dt><dd>{certificate.expires_on ? certificateDate(certificate.expires_on) : "No expiry recorded"}</dd></div>
                <div><dt>Record checked</dt><dd>{certificateDate(certificate.verified_at)}</dd></div>
              </dl>
              {certificate.verification_url ? (
                <a className="primary-button" href={certificate.verification_url} target="_blank" rel="noopener noreferrer">
                  Verify with issuer <ExternalLink />
                </a>
              ) : null}
            </section>
            <section className="certificate-validity-note">
              <CalendarDays />
              <div>
                <strong>{status === "expired" ? "Historical certificate" : "Current verification"}</strong>
                <p>{status === "expired" ? "This certificate remains visible for transparency but its recorded validity period has ended." : "The certificate is published as verified. Always review its scope and validity dates."}</p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}


"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Award, BadgeCheck, CalendarDays, ChevronRight, FileCheck2, ShieldCheck } from "lucide-react";
import {
  certificateDate,
  certificateError,
  certificateSelect,
  labelCertificateStatus,
  labelCertificateType,
  publicCertificateStatus,
  type Certificate,
  type CertificateTargetType,
} from "@/lib/certificates";
import { createClient } from "@/lib/supabase/client";

const targetColumns: Record<CertificateTargetType, string> = {
  profile: "professional_profile_id",
  listing: "listing_id",
  offering: "professional_offering_id",
  subject: "subject_id",
};

type LinkedCertificateRow = {
  certificate_id: string;
  certificates: Certificate | Certificate[] | null;
};

export function EntityCertificates({
  targetType,
  targetId,
  compact = false,
}: {
  targetType: CertificateTargetType;
  targetId: string;
  compact?: boolean;
}) {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const supabase = createClient();
        const { data, error: loadError } = await supabase
          .from("certificate_links")
          .select(`certificate_id,certificates!inner(${certificateSelect})`)
          .eq(targetColumns[targetType], targetId)
          .order("created_at", { ascending: false });
        if (loadError) throw loadError;
        if (!mounted) return;
        const rows = (data ?? []) as unknown as LinkedCertificateRow[];
        setCertificates(
          rows.flatMap((row) => {
            if (!row.certificates) return [];
            return Array.isArray(row.certificates) ? row.certificates : [row.certificates];
          }),
        );
      } catch (caught) {
        if (mounted) setError(certificateError(caught));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [targetId, targetType]);

  if (compact) {
    if (loading || error || !certificates.length) return null;
    return (
      <Link className="entity-certificates-compact" href={`/certificates?${targetType}=${targetId}`}>
        <ShieldCheck />
        <span>
          <strong>{certificates.length} certificate{certificates.length === 1 ? "" : "s"}</strong>
          <small>View linked records</small>
        </span>
      </Link>
    );
  }

  if (loading) {
    return (
      <section className="entity-certificates entity-certificates-loading">
        <FileCheck2 />
        <span>Checking linked certificates…</span>
      </section>
    );
  }
  if (error || !certificates.length) return null;

  return (
    <section className="entity-certificates" aria-labelledby={`certificates-${targetType}-${targetId}`}>
      <header>
        <div>
          <p className="eyebrow"><ShieldCheck /> Certificates & verification</p>
          <h2 id={`certificates-${targetType}-${targetId}`}>Linked certificates</h2>
          <p>Open a certificate to review its issuer, validity, linked records and complete document.</p>
        </div>
        <Link href="/certificates">All certificates <ChevronRight /></Link>
      </header>
      <div className="entity-certificate-grid">
        {certificates.map((certificate) => {
          const status = publicCertificateStatus(certificate);
          return (
            <Link className="entity-certificate-card" href={`/certificates/${certificate.slug}`} key={certificate.id}>
              <span className={`certificate-seal certificate-seal-${status}`}><Award /></span>
              <span>
                <small>{labelCertificateType(certificate.certificate_type)}</small>
                <strong>{certificate.title}</strong>
                <em>{certificate.issuer}</em>
              </span>
              <span className="entity-certificate-meta">
                <b className={`certificate-status certificate-status-${status}`}>
                  <BadgeCheck /> {labelCertificateStatus(certificate.status, certificate.expires_on)}
                </b>
                <small><CalendarDays /> {certificate.expires_on ? `Valid until ${certificateDate(certificate.expires_on)}` : "No expiry recorded"}</small>
              </span>
              <ChevronRight />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

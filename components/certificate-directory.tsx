"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Award,
  BadgeCheck,
  Building2,
  CalendarDays,
  FileCheck2,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  certificateDate,
  labelCertificateStatus,
  labelCertificateType,
  publicCertificateStatus,
  type Certificate,
  type CertificateTargetType,
} from "@/lib/certificates";

export type CertificateEntitySummary = {
  id: string;
  type: CertificateTargetType;
  name: string;
  label: string;
  href: string;
};

export type CertificateDirectoryItem = Certificate & {
  entities: CertificateEntitySummary[];
};

export function CertificateDirectory({
  certificates,
  initialTargetId = "",
}: {
  certificates: CertificateDirectoryItem[];
  initialTargetId?: string;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [validity, setValidity] = useState("all");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return certificates.filter((certificate) => {
      const status = publicCertificateStatus(certificate);
      if (initialTargetId && !certificate.entities.some((entity) => entity.id === initialTargetId)) return false;
      if (type !== "all" && certificate.certificate_type !== type) return false;
      if (validity !== "all" && status !== validity) return false;
      if (!needle) return true;
      return [
        certificate.title,
        certificate.issuer,
        certificate.certificate_number,
        certificate.summary,
        labelCertificateType(certificate.certificate_type),
        ...certificate.entities.flatMap((entity) => [entity.name, entity.label]),
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [certificates, initialTargetId, query, type, validity]);

  const types = useMemo(
    () => [...new Set(certificates.map((certificate) => certificate.certificate_type))].sort(),
    [certificates],
  );

  return (
    <section className="certificate-directory-section">
      <div className="site-container">
        <div className="certificate-directory-toolbar">
          <label className="certificate-directory-search">
            <Search />
            <span className="sr-only">Search certificates</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search certificate, issuer, number or linked record…"
            />
          </label>
          <label>
            <span>Certificate type</span>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="all">All certificate types</option>
              {types.map((item) => (
                <option value={item} key={item}>{labelCertificateType(item)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Validity</span>
            <select value={validity} onChange={(event) => setValidity(event.target.value)}>
              <option value="all">Current and expired</option>
              <option value="verified">Verified and current</option>
              <option value="expired">Expired</option>
            </select>
          </label>
        </div>

        <div className="certificate-directory-result">
          <span>{visible.length} certificate{visible.length === 1 ? "" : "s"}</span>
          {initialTargetId ? <Link href="/certificates">Clear linked-record filter</Link> : null}
        </div>

        {!visible.length ? (
          <div className="certificate-empty">
            <FileCheck2 />
            <h2>No matching certificates</h2>
            <p>Try another keyword or filter. Certificates appear here after they are verified and published.</p>
          </div>
        ) : (
          <div className="certificate-directory-grid">
            {visible.map((certificate) => {
              const status = publicCertificateStatus(certificate);
              return (
                <article className="certificate-directory-card" key={certificate.id}>
                  <header>
                    <span className={`certificate-seal certificate-seal-${status}`}><Award /></span>
                    <div>
                      <p>{labelCertificateType(certificate.certificate_type)}</p>
                      <h2>{certificate.title}</h2>
                      <span>{certificate.issuer}</span>
                    </div>
                    <b className={`certificate-status certificate-status-${status}`}>
                      <BadgeCheck /> {labelCertificateStatus(certificate.status, certificate.expires_on)}
                    </b>
                  </header>
                  <p>{certificate.summary}</p>
                  <div className="certificate-directory-dates">
                    <span><small>Certificate number</small><strong>{certificate.certificate_number}</strong></span>
                    <span><small>Issued</small><strong>{certificateDate(certificate.issued_on)}</strong></span>
                    <span><small>Expiry</small><strong>{certificate.expires_on ? certificateDate(certificate.expires_on) : "No expiry"}</strong></span>
                  </div>
                  {certificate.entities.length ? (
                    <div className="certificate-linked-entities">
                      <small>Linked to</small>
                      <div>
                        {certificate.entities.slice(0, 4).map((entity) => (
                          <Link href={entity.href} key={`${entity.type}-${entity.id}`}>
                            {entity.type === "subject" && entity.label === "Farm" ? <Building2 /> : entity.type === "profile" || entity.label === "Person" ? <UserRound /> : <ShieldCheck />}
                            <span><strong>{entity.name}</strong><small>{entity.label}</small></span>
                          </Link>
                        ))}
                        {certificate.entities.length > 4 ? <span className="certificate-more-links">+{certificate.entities.length - 4} more</span> : null}
                      </div>
                    </div>
                  ) : (
                    <div className="certificate-unlinked"><ShieldCheck /> Independent certificate record</div>
                  )}
                  <footer>
                    <span><CalendarDays /> {status === "verified" ? "Validity checked" : "Historical certificate"}</span>
                    <Link className="primary-button" href={`/certificates/${certificate.slug}`}>Read full certificate</Link>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}


"use client";
/* eslint-disable @next/next/no-img-element -- Admin previews can use managed external subject images. */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  BadgeCheck,
  Building2,
  Eye,
  FileCheck2,
  FileText,
  Link2,
  LoaderCircle,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { AdminAccessCard, type AdminAccessState } from "@/components/admin-access-card";
import { AdminSidebar } from "@/components/admin-sidebar";
import {
  certificateError,
  certificateLinkSelect,
  certificateSelect,
  certificateSlug,
  certificateStatuses,
  certificateSubjectSelect,
  certificateTypes,
  labelCertificateStatus,
  labelCertificateType,
  safeCertificateDocumentName,
  validateCertificateDocument,
  type Certificate,
  type CertificateLink,
  type CertificateListingTarget,
  type CertificateOfferingTarget,
  type CertificateProfileTarget,
  type CertificateStatus,
  type CertificateSubject,
  type CertificateSubjectKind,
} from "@/lib/certificates";
import { createClient } from "@/lib/supabase/admin-client";

type WorkspaceTab = "certificates" | "subjects";
type CertificateForm = {
  id: string;
  slug: string;
  title: string;
  certificateType: string;
  issuer: string;
  certificateNumber: string;
  summary: string;
  fullText: string;
  issuedOn: string;
  validFrom: string;
  expiresOn: string;
  status: CertificateStatus;
  verificationUrl: string;
  documentUrl: string;
  documentPath: string;
  documentMimeType: string;
  isPublic: boolean;
};
type SubjectForm = {
  id: string;
  kind: CertificateSubjectKind;
  slug: string;
  displayName: string;
  subtitle: string;
  location: string;
  description: string;
  imageUrl: string;
  isPublic: boolean;
};
type LinkSelection = {
  profiles: string[];
  listings: string[];
  offerings: string[];
  subjects: string[];
};

const permittedRoles = new Set([
  "super_admin",
  "product_inventory_manager",
  "customer_support",
  "content_promotion_manager",
]);

const emptyCertificate: CertificateForm = {
  id: "",
  slug: "",
  title: "",
  certificateType: "other",
  issuer: "",
  certificateNumber: "",
  summary: "",
  fullText: "",
  issuedOn: "",
  validFrom: "",
  expiresOn: "",
  status: "draft",
  verificationUrl: "",
  documentUrl: "",
  documentPath: "",
  documentMimeType: "",
  isPublic: false,
};
const emptySubject: SubjectForm = {
  id: "",
  kind: "farm",
  slug: "",
  displayName: "",
  subtitle: "",
  location: "",
  description: "",
  imageUrl: "",
  isPublic: true,
};
const emptyLinks: LinkSelection = { profiles: [], listings: [], offerings: [], subjects: [] };

function certificateToForm(certificate: Certificate): CertificateForm {
  return {
    id: certificate.id,
    slug: certificate.slug,
    title: certificate.title,
    certificateType: certificate.certificate_type,
    issuer: certificate.issuer,
    certificateNumber: certificate.certificate_number,
    summary: certificate.summary,
    fullText: certificate.full_text ?? "",
    issuedOn: certificate.issued_on ?? "",
    validFrom: certificate.valid_from ?? "",
    expiresOn: certificate.expires_on ?? "",
    status: certificate.status,
    verificationUrl: certificate.verification_url ?? "",
    documentUrl: certificate.document_url ?? "",
    documentPath: certificate.document_storage_path ?? "",
    documentMimeType: certificate.document_mime_type ?? "",
    isPublic: certificate.is_public,
  };
}

function subjectToForm(subject: CertificateSubject): SubjectForm {
  return {
    id: subject.id,
    kind: subject.kind,
    slug: subject.slug,
    displayName: subject.display_name,
    subtitle: subject.subtitle ?? "",
    location: subject.location ?? "",
    description: subject.description ?? "",
    imageUrl: subject.image_url ?? "",
    isPublic: subject.is_public,
  };
}

export default function AdminCertificatesPage() {
  const [access, setAccess] = useState<AdminAccessState>("loading");
  const [userId, setUserId] = useState("");
  const [tab, setTab] = useState<WorkspaceTab>("certificates");
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [links, setLinks] = useState<CertificateLink[]>([]);
  const [subjects, setSubjects] = useState<CertificateSubject[]>([]);
  const [profiles, setProfiles] = useState<CertificateProfileTarget[]>([]);
  const [listings, setListings] = useState<CertificateListingTarget[]>([]);
  const [offerings, setOfferings] = useState<CertificateOfferingTarget[]>([]);
  const [selectedCertificateId, setSelectedCertificateId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [certificateForm, setCertificateForm] = useState<CertificateForm>(emptyCertificate);
  const [subjectForm, setSubjectForm] = useState<SubjectForm>(emptySubject);
  const [linkSelection, setLinkSelection] = useState<LinkSelection>(emptyLinks);
  const [query, setQuery] = useState("");
  const [linkQuery, setLinkQuery] = useState("");
  const [pendingDocument, setPendingDocument] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const [
        certificateResult,
        linkResult,
        subjectResult,
        profileResult,
        listingResult,
        offeringResult,
      ] = await Promise.all([
        supabase.from("certificates").select(certificateSelect).order("created_at", { ascending: false }),
        supabase.from("certificate_links").select(certificateLinkSelect),
        supabase.from("certificate_subjects").select(certificateSubjectSelect).order("display_name"),
        supabase.from("professional_profiles").select("id,slug,role,name,position_title,organization_name,status").order("name"),
        supabase.from("listings").select("id,slug,kind,name_en,status").order("name_en"),
        supabase.from("professional_offerings").select("id,profile_id,kind,title,status,professional_profiles(id,slug,name)").order("title"),
      ]);
      const firstError = [
        certificateResult.error,
        linkResult.error,
        subjectResult.error,
        profileResult.error,
        listingResult.error,
        offeringResult.error,
      ].find(Boolean);
      if (firstError) throw firstError;
      const certificateRows = (certificateResult.data ?? []) as unknown as Certificate[];
      const subjectRows = (subjectResult.data ?? []) as unknown as CertificateSubject[];
      setCertificates(certificateRows);
      setLinks((linkResult.data ?? []) as unknown as CertificateLink[]);
      setSubjects(subjectRows);
      setProfiles((profileResult.data ?? []) as unknown as CertificateProfileTarget[]);
      setListings((listingResult.data ?? []) as unknown as CertificateListingTarget[]);
      setOfferings((offeringResult.data ?? []) as unknown as CertificateOfferingTarget[]);
      setSelectedCertificateId((current) => current === "new" || certificateRows.some((item) => item.id === current) ? current : certificateRows[0]?.id ?? "");
      setSelectedSubjectId((current) => current === "new" || subjectRows.some((item) => item.id === current) ? current : subjectRows[0]?.id ?? "");
    } catch (caught) {
      setError(certificateError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const verify = async () => {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        if (mounted) setAccess("signed-out");
        return;
      }
      if (mounted) setUserId(authData.user.id);
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id);
      if (roleError || !(roleData ?? []).some((item) => permittedRoles.has(String(item.role)))) {
        if (mounted) setAccess("denied");
        return;
      }
      if (!mounted) return;
      setAccess("allowed");
      await loadWorkspace();
    };
    void verify();
    return () => { mounted = false; };
  }, [loadWorkspace]);

  const selectedCertificate = certificates.find((item) => item.id === selectedCertificateId) ?? null;
  const selectedSubject = subjects.find((item) => item.id === selectedSubjectId) ?? null;

  useEffect(() => {
    queueMicrotask(() => {
      setPendingDocument(null);
      setMessage("");
      setError("");
      if (selectedCertificateId === "new") {
        setCertificateForm(emptyCertificate);
        setLinkSelection(emptyLinks);
        return;
      }
      if (!selectedCertificate) return;
      setCertificateForm(certificateToForm(selectedCertificate));
      const certificateLinks = links.filter((link) => link.certificate_id === selectedCertificate.id);
      setLinkSelection({
        profiles: certificateLinks.flatMap((link) => link.professional_profile_id ? [link.professional_profile_id] : []),
        listings: certificateLinks.flatMap((link) => link.listing_id ? [link.listing_id] : []),
        offerings: certificateLinks.flatMap((link) => link.professional_offering_id ? [link.professional_offering_id] : []),
        subjects: certificateLinks.flatMap((link) => link.subject_id ? [link.subject_id] : []),
      });
    });
  }, [links, selectedCertificate, selectedCertificateId]);

  useEffect(() => {
    queueMicrotask(() => {
      setMessage("");
      setError("");
      if (selectedSubjectId === "new") setSubjectForm(emptySubject);
      else if (selectedSubject) setSubjectForm(subjectToForm(selectedSubject));
    });
  }, [selectedSubject, selectedSubjectId]);

  const filteredCertificates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return certificates;
    return certificates.filter((certificate) => [
      certificate.title,
      certificate.issuer,
      certificate.certificate_number,
      labelCertificateType(certificate.certificate_type),
    ].some((value) => value.toLowerCase().includes(needle)));
  }, [certificates, query]);

  const filteredSubjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return subjects;
    return subjects.filter((subject) => [
      subject.display_name,
      subject.subtitle ?? "",
      subject.location ?? "",
      subject.kind,
    ].some((value) => value.toLowerCase().includes(needle)));
  }, [query, subjects]);

  const visibleTargets = useMemo(() => {
    const needle = linkQuery.trim().toLowerCase();
    return {
      profiles: profiles.filter((item) => !needle || [item.name, item.position_title, item.organization_name ?? ""].some((value) => value.toLowerCase().includes(needle))),
      listings: listings.filter((item) => !needle || [item.name_en, item.kind].some((value) => value.toLowerCase().includes(needle))),
      offerings: offerings.filter((item) => !needle || [item.title, item.professional_profiles?.name ?? ""].some((value) => value.toLowerCase().includes(needle))),
      subjects: subjects.filter((item) => !needle || [item.display_name, item.kind].some((value) => value.toLowerCase().includes(needle))),
    };
  }, [linkQuery, listings, offerings, profiles, subjects]);

  const toggleLink = (group: keyof LinkSelection, id: string) => {
    setLinkSelection((current) => ({
      ...current,
      [group]: current[group].includes(id)
        ? current[group].filter((item) => item !== id)
        : [...current[group], id],
    }));
  };

  const saveCertificate = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    let uploadedPath = "";
    const oldPath = certificateForm.documentPath;
    try {
      if (certificateForm.title.trim().length < 3) throw new Error("Enter the certificate title.");
      if (certificateForm.issuer.trim().length < 2) throw new Error("Enter the issuing authority.");
      if (!certificateForm.certificateNumber.trim()) throw new Error("Enter the certificate number.");
      if (certificateForm.summary.trim().length < 10) throw new Error("Write a short certificate summary.");
      if (certificateForm.verificationUrl && !/^https?:\/\//i.test(certificateForm.verificationUrl)) throw new Error("The verification link must begin with http:// or https://.");
      if (certificateForm.documentUrl && !/^https?:\/\//i.test(certificateForm.documentUrl)) throw new Error("The document link must begin with http:// or https://.");
      const certificateId = certificateForm.id || crypto.randomUUID();
      const supabase = createClient();
      let documentUrl = certificateForm.documentUrl.trim() || null;
      let documentPath = certificateForm.documentPath || null;
      let documentMimeType = certificateForm.documentMimeType || null;
      if (pendingDocument) {
        validateCertificateDocument(pendingDocument);
        uploadedPath = `${certificateId}/${safeCertificateDocumentName(pendingDocument)}`;
        const { error: uploadError } = await supabase.storage
          .from("certificate-documents")
          .upload(uploadedPath, pendingDocument, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
        const publicUrl = supabase.storage.from("certificate-documents").getPublicUrl(uploadedPath).data.publicUrl;
        documentUrl = publicUrl;
        documentPath = uploadedPath;
        documentMimeType = pendingDocument.type;
      }
      if (
        certificateForm.isPublic
        && ["verified", "expired"].includes(certificateForm.status)
        && !documentUrl
        && !certificateForm.fullText.trim()
      ) {
        throw new Error("Add the complete PDF/image or a full text record before publishing.");
      }
      const payload = {
        id: certificateId,
        slug: certificateForm.slug.trim() || certificateSlug(certificateForm.title),
        title: certificateForm.title.trim(),
        certificate_type: certificateForm.certificateType,
        issuer: certificateForm.issuer.trim(),
        certificate_number: certificateForm.certificateNumber.trim(),
        summary: certificateForm.summary.trim(),
        full_text: certificateForm.fullText.trim() || null,
        issued_on: certificateForm.issuedOn || null,
        valid_from: certificateForm.validFrom || null,
        expires_on: certificateForm.expiresOn || null,
        status: certificateForm.status,
        verification_url: certificateForm.verificationUrl.trim() || null,
        document_url: documentUrl,
        document_storage_path: documentPath,
        document_mime_type: documentMimeType,
        is_public: certificateForm.isPublic,
        verified_by: certificateForm.status === "verified" || certificateForm.status === "expired" ? userId : null,
        verified_at: certificateForm.status === "verified" || certificateForm.status === "expired" ? new Date().toISOString() : null,
        created_by: selectedCertificate ? selectedCertificate.created_by : userId,
        updated_by: userId,
      };
      const { error: saveError } = await supabase.from("certificates").upsert(payload, { onConflict: "id" });
      if (saveError) throw saveError;
      const { error: deleteLinksError } = await supabase.from("certificate_links").delete().eq("certificate_id", certificateId);
      if (deleteLinksError) throw deleteLinksError;
      const linkRows = [
        ...linkSelection.profiles.map((id) => ({ certificate_id: certificateId, professional_profile_id: id, created_by: userId })),
        ...linkSelection.listings.map((id) => ({ certificate_id: certificateId, listing_id: id, created_by: userId })),
        ...linkSelection.offerings.map((id) => ({ certificate_id: certificateId, professional_offering_id: id, created_by: userId })),
        ...linkSelection.subjects.map((id) => ({ certificate_id: certificateId, subject_id: id, created_by: userId })),
      ];
      if (linkRows.length) {
        const { error: linkError } = await supabase.from("certificate_links").insert(linkRows);
        if (linkError) throw linkError;
      }
      if (pendingDocument && oldPath && oldPath !== uploadedPath) {
        await supabase.storage.from("certificate-documents").remove([oldPath]);
      }
      setSelectedCertificateId(certificateId);
      setPendingDocument(null);
      setMessage("Certificate and linked records saved.");
      await loadWorkspace();
    } catch (caught) {
      if (uploadedPath) {
        await createClient().storage.from("certificate-documents").remove([uploadedPath]);
      }
      setError(certificateError(caught));
    } finally {
      setSaving(false);
    }
  };

  const deleteCertificate = async () => {
    if (!selectedCertificate || !window.confirm(`Delete "${selectedCertificate.title}"?`)) return;
    setSaving(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase.from("certificates").delete().eq("id", selectedCertificate.id);
      if (deleteError) throw deleteError;
      if (selectedCertificate.document_storage_path) {
        await supabase.storage.from("certificate-documents").remove([selectedCertificate.document_storage_path]);
      }
      setSelectedCertificateId("");
      setMessage("Certificate deleted.");
      await loadWorkspace();
    } catch (caught) {
      setError(certificateError(caught));
    } finally {
      setSaving(false);
    }
  };

  const saveSubject = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (subjectForm.displayName.trim().length < 2) throw new Error("Enter the farm or person name.");
      if (subjectForm.imageUrl && !/^https?:\/\//i.test(subjectForm.imageUrl)) throw new Error("The image address must begin with http:// or https://.");
      const id = subjectForm.id || crypto.randomUUID();
      const supabase = createClient();
      const { error: saveError } = await supabase.from("certificate_subjects").upsert({
        id,
        kind: subjectForm.kind,
        slug: subjectForm.slug.trim() || certificateSlug(subjectForm.displayName),
        display_name: subjectForm.displayName.trim(),
        subtitle: subjectForm.subtitle.trim() || null,
        location: subjectForm.location.trim() || null,
        description: subjectForm.description.trim() || null,
        image_url: subjectForm.imageUrl.trim() || null,
        is_public: subjectForm.isPublic,
        updated_by: userId,
        ...(selectedSubject ? {} : { created_by: userId }),
      }, { onConflict: "id" });
      if (saveError) throw saveError;
      setSelectedSubjectId(id);
      setMessage("Certificate subject saved.");
      await loadWorkspace();
    } catch (caught) {
      setError(certificateError(caught));
    } finally {
      setSaving(false);
    }
  };

  if (access !== "allowed") {
    return (
      <main className="admin-shell">
        <AdminSidebar active="certificates" />
        <section className="admin-main">
          <AdminAccessCard
            access={access}
            resource="certificates"
            requirement="the Super Admin, Product & Inventory Manager, Customer Support, or Content & Promotion Manager role"
            returnTo="/admin/certificates"
          />
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <AdminSidebar active="certificates" />
      <section className="admin-main admin-certificates-main">
        <header className="admin-page-heading">
          <div><p className="eyebrow">Trust records</p><h1>Certificates & Verification</h1><p>Publish complete certificates and connect each record to the people, farms, products, rentals or services it covers.</p></div>
          <FileCheck2 />
        </header>
        <div className="admin-certificate-stats">
          <article><Award /><span><small>Total certificates</small><strong>{certificates.length}</strong></span></article>
          <article><BadgeCheck /><span><small>Published</small><strong>{certificates.filter((item) => item.is_public && ["verified", "expired"].includes(item.status)).length}</strong></span></article>
          <article><Link2 /><span><small>Entity links</small><strong>{links.length}</strong></span></article>
          <article><Building2 /><span><small>Farms & people</small><strong>{subjects.length}</strong></span></article>
        </div>
        <div className="admin-certificate-tabs">
          <button className={tab === "certificates" ? "active" : ""} type="button" onClick={() => setTab("certificates")}><FileCheck2 /> Certificates</button>
          <button className={tab === "subjects" ? "active" : ""} type="button" onClick={() => setTab("subjects")}><Building2 /> Standalone farms & people</button>
        </div>
        <div className="admin-certificate-workspace">
          <aside className="admin-certificate-list-panel">
            <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "certificates" ? "Search certificate…" : "Search farm or person…"} /></label>
            <button className="primary-button" type="button" onClick={() => tab === "certificates" ? setSelectedCertificateId("new") : setSelectedSubjectId("new")}><Plus /> New {tab === "certificates" ? "certificate" : "subject"}</button>
            <div className="admin-certificate-list">
              {loading ? <span className="admin-list-empty"><LoaderCircle className="admin-spinner" /> Loading…</span> : null}
              {tab === "certificates" ? filteredCertificates.map((certificate) => (
                <button className={selectedCertificateId === certificate.id ? "selected" : ""} type="button" key={certificate.id} onClick={() => setSelectedCertificateId(certificate.id)}>
                  <span className={`certificate-seal certificate-seal-${certificate.status}`}><Award /></span>
                  <span><strong>{certificate.title}</strong><small>{certificate.issuer}</small><em>{certificate.certificate_number}</em></span>
                  <b className={`certificate-status certificate-status-${certificate.status}`}>{labelCertificateStatus(certificate.status, certificate.expires_on)}</b>
                </button>
              )) : filteredSubjects.map((subject) => (
                <button className={selectedSubjectId === subject.id ? "selected" : ""} type="button" key={subject.id} onClick={() => setSelectedSubjectId(subject.id)}>
                  <span className="certificate-subject-list-icon">{subject.kind === "farm" ? <Building2 /> : <UserRound />}</span>
                  <span><strong>{subject.display_name}</strong><small>{subject.subtitle || subject.location || `Certificate-only ${subject.kind}`}</small></span>
                </button>
              ))}
            </div>
          </aside>

          {tab === "certificates" ? (
            <section className="admin-certificate-editor">
              <header className="panel-heading">
                <div><p className="eyebrow">{certificateForm.id ? "Edit certificate" : "New certificate"}</p><h2>{certificateForm.title || "Certificate record"}</h2></div>
                <div>{certificateForm.slug && certificateForm.isPublic ? <Link href={`/certificates/${certificateForm.slug}`} target="_blank"><Eye /> Public page</Link> : null}{selectedCertificate ? <button className="danger-button" type="button" onClick={() => void deleteCertificate()}><Trash2 /> Delete</button> : null}</div>
              </header>
              <div className="admin-form admin-certificate-form">
                <div className="form-grid">
                  <label className="span-two">Certificate title<input value={certificateForm.title} onChange={(event) => setCertificateForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Organic Production Certification" /></label>
                  <label>Certificate type<select value={certificateForm.certificateType} onChange={(event) => setCertificateForm((current) => ({ ...current, certificateType: event.target.value }))}>{certificateTypes.map((item) => <option value={item} key={item}>{labelCertificateType(item)}</option>)}</select></label>
                  <label>Status<select value={certificateForm.status} onChange={(event) => setCertificateForm((current) => ({ ...current, status: event.target.value as CertificateStatus }))}>{certificateStatuses.map((item) => <option value={item} key={item}>{labelCertificateStatus(item)}</option>)}</select></label>
                  <label>Issuing authority<input value={certificateForm.issuer} onChange={(event) => setCertificateForm((current) => ({ ...current, issuer: event.target.value }))} /></label>
                  <label>Certificate number<input value={certificateForm.certificateNumber} onChange={(event) => setCertificateForm((current) => ({ ...current, certificateNumber: event.target.value }))} /></label>
                  <label>Issued on<input type="date" value={certificateForm.issuedOn} onChange={(event) => setCertificateForm((current) => ({ ...current, issuedOn: event.target.value }))} /></label>
                  <label>Valid from<input type="date" value={certificateForm.validFrom} onChange={(event) => setCertificateForm((current) => ({ ...current, validFrom: event.target.value }))} /></label>
                  <label>Expires on<input type="date" value={certificateForm.expiresOn} onChange={(event) => setCertificateForm((current) => ({ ...current, expiresOn: event.target.value }))} /></label>
                  <label>Issuer verification URL<input type="url" value={certificateForm.verificationUrl} onChange={(event) => setCertificateForm((current) => ({ ...current, verificationUrl: event.target.value }))} placeholder="https://…" /></label>
                  <label className="span-two">Public summary<textarea value={certificateForm.summary} maxLength={1200} onChange={(event) => setCertificateForm((current) => ({ ...current, summary: event.target.value }))} /></label>
                  <label className="span-two">Full text record <small>Optional when a full PDF/image is uploaded</small><textarea className="certificate-textarea-tall" value={certificateForm.fullText} onChange={(event) => setCertificateForm((current) => ({ ...current, fullText: event.target.value }))} /></label>
                </div>
                <section className="certificate-document-upload">
                  <div><Upload /><span><strong>Complete certificate document</strong><small>PDF, JPG, PNG or WebP · maximum 10 MB</small></span></div>
                  <input id="certificate-document" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setPendingDocument(event.target.files?.[0] ?? null)} />
                  <label htmlFor="certificate-document" className="secondary-button"><FileText /> {pendingDocument ? "Replace selected file" : "Choose document"}</label>
                  {pendingDocument ? <span className="certificate-selected-file"><BadgeCheck /> {pendingDocument.name}</span> : certificateForm.documentUrl ? <a href={certificateForm.documentUrl} target="_blank" rel="noopener noreferrer"><Eye /> View current document</a> : <span>No document selected</span>}
                </section>
                <section className="certificate-link-editor">
                  <header><div><p className="eyebrow"><Link2 /> Connections</p><h3>Link this certificate</h3><p>Leave all groups empty when the certificate should remain independent.</p></div><label><Search /><input value={linkQuery} onChange={(event) => setLinkQuery(event.target.value)} placeholder="Search records…" /></label></header>
                  <div className="certificate-link-groups">
                    <details open><summary>Advisors, Experts & Partners <b>{linkSelection.profiles.length}</b></summary><div>{visibleTargets.profiles.map((item) => <label key={item.id}><input type="checkbox" checked={linkSelection.profiles.includes(item.id)} onChange={() => toggleLink("profiles", item.id)} /><span><strong>{item.name}</strong><small>{item.position_title}</small></span></label>)}</div></details>
                    <details open><summary>Products, services & rentals <b>{linkSelection.listings.length}</b></summary><div>{visibleTargets.listings.map((item) => <label key={item.id}><input type="checkbox" checked={linkSelection.listings.includes(item.id)} onChange={() => toggleLink("listings", item.id)} /><span><strong>{item.name_en}</strong><small>{labelCertificateType(item.kind)}</small></span></label>)}</div></details>
                    <details><summary>Professional services <b>{linkSelection.offerings.length}</b></summary><div>{visibleTargets.offerings.map((item) => <label key={item.id}><input type="checkbox" checked={linkSelection.offerings.includes(item.id)} onChange={() => toggleLink("offerings", item.id)} /><span><strong>{item.title}</strong><small>{item.professional_profiles?.name || "Professional offering"}</small></span></label>)}</div></details>
                    <details><summary>Standalone farms & people <b>{linkSelection.subjects.length}</b></summary><div>{visibleTargets.subjects.map((item) => <label key={item.id}><input type="checkbox" checked={linkSelection.subjects.includes(item.id)} onChange={() => toggleLink("subjects", item.id)} /><span><strong>{item.display_name}</strong><small>{item.kind === "farm" ? "Farm" : "Person"}</small></span></label>)}</div></details>
                  </div>
                </section>
                <label className="certificate-publish-toggle"><input type="checkbox" checked={certificateForm.isPublic} onChange={(event) => setCertificateForm((current) => ({ ...current, isPublic: event.target.checked }))} /><span><strong>Publish on the public Certificates page</strong><small>Only Verified or Expired records are visible publicly.</small></span></label>
                {error ? <div className="review-notice error">{error}</div> : null}
                {message ? <div className="review-notice success">{message}</div> : null}
                <div className="admin-editor-actions"><button className="primary-button" type="button" disabled={saving} onClick={() => void saveCertificate()}>{saving ? <LoaderCircle className="admin-spinner" /> : <Save />} Save certificate</button></div>
              </div>
            </section>
          ) : (
            <section className="admin-certificate-editor">
              <header className="panel-heading"><div><p className="eyebrow">{subjectForm.id ? "Edit subject" : "New subject"}</p><h2>{subjectForm.displayName || "Standalone farm or person"}</h2></div>{subjectForm.slug && subjectForm.isPublic ? <Link href={`/certificates/subjects/${subjectForm.slug}`} target="_blank"><Eye /> Public page</Link> : null}</header>
              <div className="admin-form admin-certificate-form">
                <div className="certificate-subject-kind">
                  <button className={subjectForm.kind === "farm" ? "active" : ""} type="button" onClick={() => setSubjectForm((current) => ({ ...current, kind: "farm" }))}><Building2 /> Farm</button>
                  <button className={subjectForm.kind === "person" ? "active" : ""} type="button" onClick={() => setSubjectForm((current) => ({ ...current, kind: "person" }))}><UserRound /> Person</button>
                </div>
                <div className="form-grid">
                  <label className="span-two">Display name<input value={subjectForm.displayName} onChange={(event) => setSubjectForm((current) => ({ ...current, displayName: event.target.value }))} /></label>
                  <label>Subtitle<input value={subjectForm.subtitle} onChange={(event) => setSubjectForm((current) => ({ ...current, subtitle: event.target.value }))} placeholder={subjectForm.kind === "farm" ? "Farm type or registration name" : "Role or qualification"} /></label>
                  <label>Location<input value={subjectForm.location} onChange={(event) => setSubjectForm((current) => ({ ...current, location: event.target.value }))} /></label>
                  <label className="span-two">Image URL<input type="url" value={subjectForm.imageUrl} onChange={(event) => setSubjectForm((current) => ({ ...current, imageUrl: event.target.value }))} placeholder="https://…" /></label>
                  <label className="span-two">Description<textarea value={subjectForm.description} onChange={(event) => setSubjectForm((current) => ({ ...current, description: event.target.value }))} /></label>
                </div>
                {subjectForm.imageUrl ? <div className="certificate-subject-preview"><img src={subjectForm.imageUrl} alt="" /><span><strong>Image preview</strong><small>The image appears on the public subject page.</small></span></div> : null}
                <label className="certificate-publish-toggle"><input type="checkbox" checked={subjectForm.isPublic} onChange={(event) => setSubjectForm((current) => ({ ...current, isPublic: event.target.checked }))} /><span><strong>Show this subject publicly</strong><small>Its page displays all linked certificates.</small></span></label>
                {error ? <div className="review-notice error">{error}</div> : null}
                {message ? <div className="review-notice success">{message}</div> : null}
                <div className="admin-editor-actions"><button className="primary-button" type="button" disabled={saving} onClick={() => void saveSubject()}>{saving ? <LoaderCircle className="admin-spinner" /> : <Save />} Save subject</button></div>
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

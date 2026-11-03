"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Award,
  FileCheck2,
  FileUp,
  LoaderCircle,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import {
  certificateSelect,
  certificateTypes,
  labelCertificateStatus,
  type Certificate,
} from "@/lib/certificates";
import { createClient } from "@/lib/supabase/client";

type CredentialRow = {
  certificate_id: string;
  certificates: Certificate | Certificate[] | null;
};

type UploadForm = {
  title: string;
  certificateType: string;
  issuer: string;
  certificateNumber: string;
  issuedOn: string;
};

const acceptedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const maxBytes = 10 * 1024 * 1024;

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(-120);
}

function slugify(value: string) {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "credential"}-${suffix}`;
}

function reviewLabel(certificate: Certificate) {
  if (certificate.status === "draft") return "Under khetE review";
  if (certificate.status === "verified" && certificate.is_public) return "Published on your profile";
  if (certificate.status === "verified") return "Verified — internal record";
  return labelCertificateStatus(certificate.status, certificate.expires_on);
}

export function ProfessionalCredentials({ profileId }: { profileId: string }) {
  const [credentials, setCredentials] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<UploadForm>({
    title: "",
    certificateType: "training",
    issuer: "",
    certificateNumber: "",
    issuedOn: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: loadError } = await supabase
        .from("certificate_links")
        .select(`certificate_id,certificates!inner(${certificateSelect})`)
        .eq("professional_profile_id", profileId)
        .order("created_at", { ascending: false });
      if (loadError) throw loadError;
      const rows = (data ?? []) as unknown as CredentialRow[];
      setCredentials(
        rows.flatMap((row) => {
          if (!row.certificates) return [];
          return Array.isArray(row.certificates) ? row.certificates : [row.certificates];
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Credentials could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  const chooseFile = (files: FileList | null) => {
    setNotice("");
    setError("");
    const selected = files?.[0] ?? null;
    if (!selected) {
      setFile(null);
      return;
    }
    if (!acceptedTypes.has(selected.type)) {
      setError("Upload a JPG, PNG, WEBP or PDF document.");
      setFile(null);
      return;
    }
    if (selected.size > maxBytes) {
      setError("The document must be smaller than 10 MB.");
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profileId || !file) {
      setError("Choose the document file to upload.");
      return;
    }
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sign in again to upload credentials.");

      const storagePath = `profiles/${profileId}/${Date.now()}-${safeFileName(file.name)}`;
      const { error: storageError } = await supabase.storage
        .from("certificate-documents")
        .upload(storagePath, file, { cacheControl: "31536000", upsert: false });
      if (storageError) throw storageError;

      const title = form.title.trim();
      const issuer = form.issuer.trim();
      const { data: inserted, error: insertError } = await supabase
        .from("certificates")
        .insert({
          slug: slugify(title),
          title,
          certificate_type: form.certificateType,
          issuer,
          certificate_number: form.certificateNumber.trim() || "Not stated",
          summary: `${title} issued by ${issuer}. Uploaded for khetE verification; the document stays private unless the khetE team approves it for publication.`,
          issued_on: form.issuedOn || null,
          status: "draft",
          is_public: false,
          document_storage_path: storagePath,
          document_mime_type: file.type,
          created_by: userId,
        })
        .select("id")
        .single();
      if (insertError) {
        await supabase.storage.from("certificate-documents").remove([storagePath]);
        throw insertError;
      }

      const { error: linkError } = await supabase
        .from("certificate_links")
        .insert({
          certificate_id: inserted.id,
          professional_profile_id: profileId,
          created_by: userId,
        });
      if (linkError) throw linkError;

      setNotice(`"${title}" was uploaded and is now under khetE review.`);
      setFile(null);
      setForm({ title: "", certificateType: "training", issuer: "", certificateNumber: "", issuedOn: "" });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The upload could not be completed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="professional-credentials">
      <div className="professional-credentials-upload">
        <header>
          <p className="eyebrow"><UploadCloud /> Upload a certificate or document</p>
          <h3>Add a credential to your profile</h3>
          <p>
            Upload degrees, registrations, training certificates or recognitions. Every upload is
            reviewed by the khetE team first — only they can verify it and decide whether the title
            becomes public on your profile. The document itself always stays private to khetE.
          </p>
        </header>
        <form onSubmit={upload}>
          {error ? <div className="professional-service-form-error">{error}</div> : null}
          {notice ? <div className="professional-credentials-notice">{notice}</div> : null}
          <div className="form-grid">
            <label className="span-two">
              Certificate / document title
              <input
                required
                minLength={3}
                maxLength={180}
                placeholder="e.g. B.Sc. Agriculture, Pesticide Applicator License"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
            </label>
            <label>
              Type
              <select
                value={form.certificateType}
                onChange={(event) => setForm((current) => ({ ...current, certificateType: event.target.value }))}
              >
                {certificateTypes.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Issuing organization
              <input
                required
                minLength={2}
                maxLength={180}
                placeholder="e.g. IAAS, Rampur"
                value={form.issuer}
                onChange={(event) => setForm((current) => ({ ...current, issuer: event.target.value }))}
              />
            </label>
            <label>
              Certificate number (optional)
              <input
                maxLength={120}
                value={form.certificateNumber}
                onChange={(event) => setForm((current) => ({ ...current, certificateNumber: event.target.value }))}
              />
            </label>
            <label>
              Issue date (optional)
              <input
                type="date"
                value={form.issuedOn}
                onChange={(event) => setForm((current) => ({ ...current, issuedOn: event.target.value }))}
              />
            </label>
            <label className="span-two professional-credentials-file">
              Document (JPG, PNG, WEBP or PDF, max 10 MB)
              <input
                className="sr-only"
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.pdf"
                onChange={(event) => chooseFile(event.target.files)}
              />
              <span><FileUp /> {file ? file.name : "Choose document…"}</span>
            </label>
          </div>
          <button className="primary-button professional-request-submit" type="submit" disabled={submitting}>
            {submitting ? <LoaderCircle className="admin-spinner" /> : <UploadCloud />}
            {submitting ? "Uploading…" : "Upload for khetE review"}
          </button>
        </form>
      </div>

      <div className="professional-credentials-list">
        <header>
          <p className="eyebrow"><Award /> Your credentials</p>
          <h3>{credentials.length} uploaded</h3>
        </header>
        {loading ? (
          <div className="professional-dashboard-empty"><LoaderCircle className="admin-spinner" /><strong>Loading credentials…</strong></div>
        ) : !credentials.length ? (
          <div className="professional-dashboard-empty">
            <FileCheck2 />
            <strong>No credentials uploaded yet</strong>
            <p>Upload your first certificate or document above — the khetE team will review it.</p>
          </div>
        ) : (
          credentials.map((certificate) => (
            <article key={certificate.id} className="professional-credential-row">
              <span className={`certificate-seal certificate-seal-${certificate.status === "verified" ? "verified" : "draft"}`}>
                <Award />
              </span>
              <div>
                <strong>{certificate.title}</strong>
                <small>{certificate.issuer} · {certificate.certificate_type}</small>
              </div>
              <em className={`professional-status professional-credential-${certificate.status}${certificate.is_public ? " is-public" : ""}`}>
                {reviewLabel(certificate)}
              </em>
            </article>
          ))
        )}
        <p className="professional-credentials-privacy">
          <ShieldCheck /> Private by default: uploaded documents are visible only to the khetE
          verification team. If approved, only the title shows on your public profile.
        </p>
      </div>
    </div>
  );
}

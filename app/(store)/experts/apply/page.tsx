"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  FileCheck2,
  LoaderCircle,
  MessageCircle,
  Send,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useMarketplace } from "@/components/marketplace-provider";
import { BrandName } from "@/components/brand-name";
import {
  labelProfessionalApplicationStatus,
  labelProfessionalRole,
  professionalApplicationSelect,
  professionalError,
  professionalRoles,
  splitProfessionalList,
  type ProfessionalApplication,
  type ProfessionalRole,
} from "@/lib/professional-network";
import { createClient } from "@/lib/supabase/client";

type ApplicationForm = {
  role: ProfessionalRole;
  name: string;
  organization: string;
  position: string;
  email: string;
  phone: string;
  location: string;
  experience: string;
  expertise: string;
  qualifications: string;
  summary: string;
  motivation: string;
  website: string;
};

const emptyForm: ApplicationForm = {
  role: "advisor",
  name: "",
  organization: "",
  position: "",
  email: "",
  phone: "",
  location: "",
  experience: "",
  expertise: "",
  qualifications: "",
  summary: "",
  motivation: "",
  website: "",
};

const roleDescriptions: Record<ProfessionalRole, string> = {
  advisor: "For experienced professionals who provide strategic or subject guidance.",
  expert_professional: "For specialists offering technical, operational or professional expertise.",
  associate_partner: "For organisations, networks and institutions collaborating with khetE.",
};

const acceptedDocumentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const maxDocumentBytes = 10 * 1024 * 1024;
const maxDocuments = 5;
const documentBucket = "application-documents";

const mimeByExtension: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

function documentMimeType(file: File) {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return mimeByExtension[extension] ?? "application/pdf";
}

function safeDocumentName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(-120);
}

export default function ProfessionalApplicationPage() {
  const { user, authReady, openLogin } = useMarketplace();
  const [form, setForm] = useState<ApplicationForm>(emptyForm);
  const [documents, setDocuments] = useState<File[]>([]);
  const [documentNotice, setDocumentNotice] = useState("");
  const [applications, setApplications] = useState<ProfessionalApplication[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<{ id: string; number: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    queueMicrotask(() => setForm((current) => ({
      ...current,
      name: current.name || (typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : ""),
      email: current.email || user.email || "",
    })));
  }, [user]);

  const loadApplications = useCallback(async () => {
    if (!user) {
      setApplications([]);
      return;
    }
    setLoadingHistory(true);
    try {
      const supabase = createClient();
      const { data, error: loadError } = await supabase
        .from("professional_applications")
        .select(professionalApplicationSelect)
        .eq("applicant_id", user.id)
        .order("created_at", { ascending: false });
      if (loadError) throw loadError;
      setApplications((data ?? []) as unknown as ProfessionalApplication[]);
    } catch (caught) {
      setError(professionalError(caught));
    } finally {
      setLoadingHistory(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authReady) return;
    queueMicrotask(() => void loadApplications());
  }, [authReady, loadApplications]);

  function update<K extends keyof ApplicationForm>(key: K, value: ApplicationForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function chooseDocuments(files: FileList | null) {
    setDocumentNotice("");
    setError("");
    const incoming = Array.from(files ?? []);
    if (!incoming.length) return;
    const accepted: File[] = [];
    for (const file of incoming) {
      if (!acceptedDocumentTypes.has(file.type)) {
        setDocumentNotice("Only JPG, PNG, WEBP or PDF documents are accepted — some files were skipped.");
        continue;
      }
      if (file.size > maxDocumentBytes) {
        setDocumentNotice("Documents must be smaller than 10 MB — some files were skipped.");
        continue;
      }
      accepted.push(file);
    }
    setDocuments((current) => [...current, ...accepted].slice(0, maxDocuments));
  }

  async function uploadDocuments(applicationId: string) {
    if (!documents.length) return "";
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return "Sign in again to attach your documents — the application itself was submitted.";
    let failures = 0;
    for (const file of documents) {
      const storagePath = `${userId}/${Date.now()}-${safeDocumentName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from(documentBucket)
        .upload(storagePath, file, { cacheControl: "31536000", upsert: false, contentType: documentMimeType(file) });
      if (uploadError) {
        failures += 1;
        continue;
      }
      const { error: recordError } = await supabase
        .from("professional_application_documents")
        .insert({
          application_id: applicationId,
          storage_path: storagePath,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          created_by: userId,
        });
      if (recordError) {
        failures += 1;
        await supabase.storage.from(documentBucket).remove([storagePath]);
      }
    }
    return failures
      ? `${failures} document${failures === 1 ? "" : "s"} could not be attached. Reply to your application ticket in Support to retry.`
      : "";
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const expertise = splitProfessionalList(form.expertise);
      if (!expertise.length) throw new Error("Add at least one field of expertise.");
      const supabase = createClient();
      const { data, error: submitError } = await supabase.rpc("create_professional_application", {
        p_role: form.role,
        p_name: form.name,
        p_organization: form.organization || null,
        p_position: form.position,
        p_email: form.email,
        p_phone: form.phone || null,
        p_location: form.location,
        p_experience: form.experience,
        p_expertise: expertise,
        p_qualifications: splitProfessionalList(form.qualifications),
        p_summary: form.summary,
        p_motivation: form.motivation,
        p_website_url: form.website || null,
      });
      if (submitError) throw submitError;
      const result = Array.isArray(data) ? data[0] : data;
      const id = result && typeof result === "object" && "application_id" in result ? String(result.application_id) : "";
      const number = result && typeof result === "object" && "application_number" in result ? String(result.application_number) : "";
      if (!id || !number) throw new Error("The application was created without a usable reference.");
      const uploadNotice = await uploadDocuments(id);
      setDocumentNotice(uploadNotice);
      setSubmitted({ id, number });
      setDocuments([]);
      setForm((current) => ({ ...emptyForm, name: current.name, email: current.email, phone: current.phone }));
      await loadApplications();
    } catch (caught) {
      setError(professionalError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="network-application-page">
      <h1 className="sr-only">Apply to join the <BrandName /> Professional Network</h1>
      <div className="site-container network-application-layout">
        <section className="network-application-form-card">
          {submitted ? (
            <div className="network-application-success">
              <CheckCircle2 />
              <p className="eyebrow">Application received</p>
              <h2>Thank you for applying.</h2>
              <p>The khetE team will review the information{documentNotice ? "" : " and documents"} before making any profile public.</p>
              {documentNotice ? <p className="network-documents-note">{documentNotice}</p> : null}
              <div><small>Application reference</small><strong>{submitted.number}</strong></div>
              <span><button className="secondary-button" type="button" onClick={() => setSubmitted(null)}>Submit another application</button><Link className="primary-button" href={`/support?type=seller_application&subject=${encodeURIComponent(`Professional Network application ${submitted.number}`)}`}><MessageCircle /> Ask Support</Link></span>
            </div>
          ) : (
            <form onSubmit={submitApplication}>
              <header><UsersRound /><div><p className="eyebrow">Online application</p><h2>Professional details</h2></div></header>

              <div className="network-role-choice">
                {professionalRoles.map((role) => <button className={form.role === role ? "selected" : ""} type="button" onClick={() => update("role", role)} key={role}><strong>{labelProfessionalRole(role)}</strong><span>{roleDescriptions[role]}</span></button>)}
              </div>

              <div className="form-grid network-form-grid">
                <label>Applicant / representative name<input required minLength={2} maxLength={120} value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
                <label>Organisation name <small>Required for Associate Partners</small><input required={form.role === "associate_partner"} maxLength={140} value={form.organization} onChange={(event) => update("organization", event.target.value)} /></label>
                <label>Professional title / partnership role<input required minLength={2} maxLength={140} value={form.position} onChange={(event) => update("position", event.target.value)} /></label>
                <label>Location<input required minLength={2} maxLength={140} value={form.location} onChange={(event) => update("location", event.target.value)} placeholder="District, Province, Nepal" /></label>
                <label>Email<input required type="email" maxLength={254} value={form.email} onChange={(event) => update("email", event.target.value)} /></label>
                <label>Phone<input type="tel" maxLength={40} value={form.phone} onChange={(event) => update("phone", event.target.value)} /></label>
                <label>Experience<input required maxLength={100} value={form.experience} onChange={(event) => update("experience", event.target.value)} placeholder="Example: 8+ years" /></label>
                <label>Website or professional profile<input type="url" maxLength={500} value={form.website} onChange={(event) => update("website", event.target.value)} placeholder="https://…" /></label>
                <label className="span-two">Fields of expertise <small>Separate with commas or new lines</small><textarea required rows={3} value={form.expertise} onChange={(event) => update("expertise", event.target.value)} placeholder="Crop planning, soil health, irrigation…" /></label>
                <label className="span-two">Qualifications <small>Separate with commas or new lines</small><textarea rows={3} value={form.qualifications} onChange={(event) => update("qualifications", event.target.value)} /></label>
                <label className="span-two">Professional summary <small>40–1200 characters</small><textarea required minLength={40} maxLength={1200} rows={5} value={form.summary} onChange={(event) => update("summary", event.target.value)} /></label>
                <label className="span-two">Why do you want to join? <small>40–1600 characters</small><textarea required minLength={40} maxLength={1600} rows={5} value={form.motivation} onChange={(event) => update("motivation", event.target.value)} /></label>
                <div className="span-two network-documents-field">
                  <span className="network-documents-label"><FileCheck2 /> Supporting documents <small>Optional — citizenship, degrees, licences, certificates</small></span>
                  <label className="network-documents-picker">
                    <input className="sr-only" type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf" onChange={(event) => chooseDocuments(event.target.files)} />
                    <span>Choose documents (JPG, PNG, WEBP, PDF — max 10 MB each, up to 5)</span>
                  </label>
                  {documents.length ? (
                    <ul className="network-documents-list">
                      {documents.map((file) => (
                        <li key={`${file.name}-${file.lastModified}`}>
                          <FileCheck2 />
                          <strong>{file.name}</strong>
                          <small>{(file.size / 1024 / 1024).toFixed(1)} MB</small>
                          <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setDocuments((current) => current.filter((item) => item !== file))}>×</button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {documentNotice && !submitted ? <p className="network-documents-note">{documentNotice}</p> : null}
                  <p className="network-documents-privacy"><ShieldCheck /> Documents are private — only the khetE review team can see them. Titles of verified credentials may later be shown on your profile.</p>
                </div>
              </div>
              {error ? <p className="support-alert error">{error}</p> : null}
              <button className="primary-button network-submit" type="submit" disabled={submitting}>{submitting ? <LoaderCircle className="admin-spinner" /> : <Send />} Submit application</button>
            </form>
          )}
        </section>

        <aside className="network-application-aside">
          <section className="network-verification-note"><ShieldCheck /><div><p className="eyebrow">Central verification</p><p>Profiles are never published automatically — every application is reviewed before a public profile is created.</p></div></section>
          <section><FileCheck2 /><p className="eyebrow">Review process</p><ol><li><strong>Submit</strong><span>Share professional or organisation details.</span></li><li><strong>Admin review</strong><span>The khetE team verifies fit and completeness.</span></li><li><strong>Decision</strong><span>Changes may be requested before approval.</span></li><li><strong>Publish</strong><span>Only approved profiles can become public.</span></li></ol></section>
          <section><BadgeCheck /><p className="eyebrow">Important</p><p>Joining the network does not automatically permit product selling or guarantee service work. Marketplace listing permissions remain separate.</p></section>
        </aside>

        {user ? <section className="network-application-history">
          <header><div><p className="eyebrow">Your account</p><h2>Application history</h2></div><button type="button" onClick={() => void loadApplications()} disabled={loadingHistory}>{loadingHistory ? <LoaderCircle className="admin-spinner" /> : <Clock3 />} Refresh</button></header>
          {!applications.length && !loadingHistory ? <p>No Professional Network applications have been submitted from this account.</p> : applications.map((application) => <article key={application.id}><div><strong>{application.application_number}</strong><span>{labelProfessionalRole(application.role)} · {new Date(application.created_at).toLocaleDateString("en-NP")}</span></div><i className={`network-status network-status-${application.status}`}>{labelProfessionalApplicationStatus(application.status)}</i>{application.admin_notes ? <p>{application.admin_notes}</p> : null}</article>)}
        </section> : authReady ? <section className="network-signin-note"><FileCheck2 /><div><strong>Want to track your application?</strong><p>Sign in before submitting so its status remains visible in your account on this page.</p></div><button className="secondary-button" type="button" onClick={openLogin}>Sign in <ArrowRight /></button></section> : null}
      </div>
    </main>
  );
}

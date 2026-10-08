"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
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

export default function ProfessionalApplicationPage() {
  const { user, authReady, openLogin } = useMarketplace();
  const [form, setForm] = useState<ApplicationForm>(emptyForm);
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
      setSubmitted({ id, number });
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
      <section className="network-application-hero">
        <div className="site-container">
          <Link className="back-link" href="/experts"><ArrowLeft /> Back to Experts & Partners</Link>
          <div><p className="eyebrow">Professional Network applications</p><h1>Bring your experience into the khetE network.</h1><p>Apply as an Advisor, Expert Professional or Associate Partner. Every application is reviewed before a public profile is created.</p></div>
          <aside><ShieldCheck /><span><strong>Central verification</strong><small>Profiles are never published automatically.</small></span></aside>
        </div>
      </section>

      <div className="site-container network-application-layout">
        <section className="network-application-form-card">
          {submitted ? (
            <div className="network-application-success">
              <CheckCircle2 />
              <p className="eyebrow">Application received</p>
              <h2>Thank you for applying.</h2>
              <p>The khetE team will review the information before making any profile public.</p>
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
              </div>
              {error ? <p className="support-alert error">{error}</p> : null}
              <button className="primary-button network-submit" type="submit" disabled={submitting}>{submitting ? <LoaderCircle className="admin-spinner" /> : <Send />} Submit application</button>
            </form>
          )}
        </section>

        <aside className="network-application-aside">
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

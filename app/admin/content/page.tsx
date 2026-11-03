"use client";

import Link from "next/link";
import { BookOpenCheck, Clock3, Eye, FilePenLine, LoaderCircle, Megaphone, RefreshCw, Save, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminAccessCard, type AdminAccessState } from "@/components/admin-access-card";
import { AdminSidebar } from "@/components/admin-sidebar";
import {
  formatPolicyDate,
  sitePolicyError,
  sitePolicyLabels,
  sitePolicyRevisionSelect,
  sitePolicySelect,
  type SitePolicyRevisionRow,
  type SitePolicyRow,
  type SitePolicyStatus,
} from "@/lib/site-policies";
import { createClient } from "@/lib/supabase/client";
import {
  STORY_MARQUEE_DEFAULT_EN,
  STORY_MARQUEE_DEFAULT_NE,
  STORY_MARQUEE_KEY,
  siteContentError,
  siteContentSelect,
  type SiteContentRow,
} from "@/lib/site-content";

const contentRoles = new Set(["super_admin", "content_promotion_manager"]);

function cloneDocument(value: SitePolicyRow) {
  return { ...value };
}

export default function AdminContentPage() {
  const [access, setAccess] = useState<AdminAccessState>("loading");
  const [accountEmail, setAccountEmail] = useState("");
  const [detectedRoles, setDetectedRoles] = useState<string[]>([]);
  const [currentOrigin, setCurrentOrigin] = useState("");
  const [userId, setUserId] = useState("");
  const [documents, setDocuments] = useState<SitePolicyRow[]>([]);
  const [selected, setSelected] = useState<SitePolicyRow | null>(null);
  const [revisions, setRevisions] = useState<SitePolicyRevisionRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [marquee, setMarquee] = useState({ value_en: STORY_MARQUEE_DEFAULT_EN, value_ne: STORY_MARQUEE_DEFAULT_NE });
  const [marqueeSaving, setMarqueeSaving] = useState(false);
  const [marqueeNotice, setMarqueeNotice] = useState("");

  const loadMarquee = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("site_content").select(siteContentSelect).eq("key", STORY_MARQUEE_KEY).maybeSingle();
    const row = data as unknown as SiteContentRow | null;
    setMarquee({
      value_en: row?.value_en?.trim() || STORY_MARQUEE_DEFAULT_EN,
      value_ne: row?.value_ne?.trim() || STORY_MARQUEE_DEFAULT_NE,
    });
  }, []);

  async function saveMarquee() {
    if (!marquee.value_en.trim()) {
      setError("The English marquee text cannot be empty.");
      return;
    }
    setMarqueeSaving(true);
    setError("");
    setMarqueeNotice("");
    const supabase = createClient();
    const { error: saveError } = await supabase
      .from("site_content")
      .upsert({
        key: STORY_MARQUEE_KEY,
        value_en: marquee.value_en.trim(),
        value_ne: marquee.value_ne.trim() || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });
    setMarqueeSaving(false);
    if (saveError) {
      setError(siteContentError(saveError));
      return;
    }
    setMarqueeNotice("Story marquee updated — it is live on the Our Story page.");
  }

  const loadDocuments = useCallback(async () => {
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from("site_policy_documents")
      .select(sitePolicySelect)
      .order("policy_key");
    if (loadError) throw loadError;
    const rows = (data ?? []) as unknown as SitePolicyRow[];
    setDocuments(rows);
    setSelected((current) => current
      ? cloneDocument(rows.find((item) => item.id === current.id) ?? current)
      : rows[0]
        ? cloneDocument(rows[0])
        : null);
  }, []);

  const loadRevisions = useCallback(async (documentId: string) => {
    const supabase = createClient();
    const { data, error: revisionError } = await supabase
      .from("site_policy_revisions")
      .select(sitePolicyRevisionSelect)
      .eq("document_id", documentId)
      .order("version", { ascending: false })
      .limit(20);
    if (revisionError) throw revisionError;
    setRevisions((data ?? []) as unknown as SitePolicyRevisionRow[]);
  }, []);

  useEffect(() => {
    let mounted = true;
    const checkAccess = async () => {
      try {
        if (mounted) setCurrentOrigin(window.location.origin);
        const supabase = createClient();
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) {
          if (mounted) setAccess("signed-out");
          return;
        }
        if (mounted) setAccountEmail(authData.user.email ?? "");
        const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", authData.user.id);
        if (roleError) throw roleError;
        const roleNames = (roles ?? []).map((item) => item.role);
        if (mounted) setDetectedRoles(roleNames);
        if (!roleNames.some((role) => contentRoles.has(role))) {
          if (mounted) setAccess("denied");
          return;
        }
        if (!mounted) return;
        setUserId(authData.user.id);
        setAccess("allowed");
        await loadDocuments();
        await loadMarquee();
      } catch (caught) {
        if (!mounted) return;
        setError(sitePolicyError(caught));
        setAccess("error");
      }
    };
    void checkAccess();
    return () => { mounted = false; };
  }, [loadDocuments, loadMarquee]);

  useEffect(() => {
    if (!selected?.id) return;
    const documentId = selected.id;
    queueMicrotask(() => void loadRevisions(documentId).catch((caught) => setError(sitePolicyError(caught))));
  }, [loadRevisions, selected?.id]);

  const stats = useMemo(() => ({
    published: documents.filter((item) => item.status === "published").length,
    drafts: documents.filter((item) => item.status === "draft").length,
    bilingual: documents.filter((item) => item.title_ne && item.body_ne).length,
  }), [documents]);

  function chooseDocument(document: SitePolicyRow) {
    setSelected(cloneDocument(document));
    setNotice("");
    setError("");
  }

  function update(field: keyof SitePolicyRow, value: string) {
    setSelected((current) => current ? { ...current, [field]: value } : current);
  }

  async function save(status: SitePolicyStatus) {
    if (!selected || !userId) return;
    if (!selected.title_en.trim() || !selected.body_en.trim()) {
      setError("English title and policy content are required.");
      return;
    }
    if (status === "published" && (!selected.title_ne?.trim() || !selected.body_ne?.trim())) {
      setError("Add the Nepali title and policy content before publishing a bilingual policy.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    const supabase = createClient();
    const { data, error: saveError } = await supabase
      .from("site_policy_documents")
      .update({
        title_en: selected.title_en.trim(),
        title_ne: selected.title_ne?.trim() || null,
        summary_en: selected.summary_en?.trim() || null,
        summary_ne: selected.summary_ne?.trim() || null,
        body_en: selected.body_en.trim(),
        body_ne: selected.body_ne?.trim() || null,
        status,
        updated_by: userId,
      })
      .eq("id", selected.id)
      .select(sitePolicySelect)
      .single();
    setSaving(false);
    if (saveError || !data) {
      setError(sitePolicyError(saveError ?? new Error("The policy could not be saved.")));
      return;
    }
    const saved = data as unknown as SitePolicyRow;
    await loadDocuments();
    setSelected(cloneDocument(saved));
    await loadRevisions(saved.id);
    setNotice(status === "published" ? `${saved.title_en} is now live as version ${saved.version}.` : `${saved.title_en} was saved as a private draft.`);
  }

  if (access !== "allowed") {
    return <AdminAccessCard access={access} error={error} email={accountEmail} roles={detectedRoles} origin={currentOrigin} resource="site policies" requirement="the Super Admin or Content & Promotion Manager role" returnTo="/admin/content" />;
  }

  return (
    <main className="admin-shell admin-content-page">
      <AdminSidebar active="content" />
      <section className="admin-main">
        <header className="admin-page-heading">
          <div><p className="eyebrow">Content & promotion manager</p><h1>Policies & legal content</h1><p>Maintain public marketplace policies in English and Nepali without changing website code.</p></div>
          <div className="admin-create-actions"><button type="button" onClick={() => void loadDocuments()}><RefreshCw /> Refresh</button></div>
        </header>

        <div className="admin-policy-review-note">
          <BookOpenCheck />
          <div><strong>Review before launch</strong><p>These are editable operational templates, not a substitute for legal advice. Have the final wording reviewed for your registered business, products, delivery model and payment methods.</p></div>
        </div>

        <section className="admin-marquee-editor">
          <header>
            <div><p className="eyebrow">Homepage text</p><h2><Megaphone /> Story page marquee</h2><p>The slim scrolling line at the very top of the Our Story page. Keep it short — one sentence works best.</p></div>
            <button className="primary-button" type="button" onClick={() => void saveMarquee()} disabled={marqueeSaving}>{marqueeSaving ? <LoaderCircle className="admin-spinner" /> : <Save />} Save marquee</button>
          </header>
          <div className="form-grid">
            <label>English text<input value={marquee.value_en} onChange={(event) => setMarquee((current) => ({ ...current, value_en: event.target.value }))} maxLength={220} /></label>
            <label className="np">नेपाली text<input className="np" value={marquee.value_ne} onChange={(event) => setMarquee((current) => ({ ...current, value_ne: event.target.value }))} maxLength={220} /></label>
          </div>
          {marqueeNotice ? <div className="admin-notice">{marqueeNotice}<button type="button" onClick={() => setMarqueeNotice("")}><X /></button></div> : null}
        </section>

        {notice ? <div className="admin-notice">{notice}<button type="button" onClick={() => setNotice("")}><X /></button></div> : null}
        {error ? <div className="admin-notice admin-error-notice">{error}<button type="button" onClick={() => setError("")}><X /></button></div> : null}

        <div className="admin-policy-stats">
          <article><BookOpenCheck /><span><small>Policy pages</small><strong>{documents.length}</strong></span></article>
          <article><Eye /><span><small>Published</small><strong>{stats.published}</strong></span></article>
          <article><FilePenLine /><span><small>Drafts</small><strong>{stats.drafts}</strong></span></article>
          <article><span className="admin-policy-language-mark">अ</span><span><small>Bilingual</small><strong>{stats.bilingual}</strong></span></article>
        </div>

        <div className="admin-policy-layout">
          <aside className="admin-policy-list-panel">
            <div className="panel-heading"><div><p className="eyebrow">Public documents</p><h2>Policy centre</h2></div></div>
            <div className="admin-policy-list">
              {documents.map((document) => <button className={selected?.id === document.id ? "selected" : ""} type="button" key={document.id} onClick={() => chooseDocument(document)}><span><strong>{document.title_en}</strong><small>{sitePolicyLabels[document.policy_key].ne}</small></span><i className={`policy-status policy-status-${document.status}`}>{document.status}</i></button>)}
            </div>
          </aside>

          <section className="admin-policy-editor">
            {selected ? (
              <form className="admin-form" onSubmit={(event) => { event.preventDefault(); void save("draft"); }}>
                <div className="panel-heading">
                  <div><p className="eyebrow">{sitePolicyLabels[selected.policy_key].short} policy</p><h2>{selected.title_en}</h2></div>
                  <div className="admin-policy-editor-meta"><span className={`policy-status policy-status-${selected.status}`}>{selected.status}</span><small>Version {selected.version}</small></div>
                </div>
                <div className="form-grid admin-policy-form-grid">
                  <label>English title<input value={selected.title_en} onChange={(event) => update("title_en", event.target.value)} maxLength={160} required /></label>
                  <label>Nepali title<input value={selected.title_ne ?? ""} onChange={(event) => update("title_ne", event.target.value)} maxLength={160} required /></label>
                  <label>English summary<textarea rows={3} value={selected.summary_en ?? ""} onChange={(event) => update("summary_en", event.target.value)} maxLength={500} /></label>
                  <label>Nepali summary<textarea rows={3} value={selected.summary_ne ?? ""} onChange={(event) => update("summary_ne", event.target.value)} maxLength={500} /></label>
                  <label>English policy content<textarea rows={22} value={selected.body_en} onChange={(event) => update("body_en", event.target.value)} required /><small>Use “## Heading” for a section and “- Item” for bullet points. Leave a blank line between blocks.</small></label>
                  <label>Nepali policy content<textarea rows={22} value={selected.body_ne ?? ""} onChange={(event) => update("body_ne", event.target.value)} required /><small>Use the same section and bullet format as the English version.</small></label>
                </div>
                <div className="admin-form-actions">
                  <button type="submit" disabled={saving}>{saving ? <LoaderCircle className="admin-spinner" /> : <Save />} {selected.status === "published" ? "Unpublish & save draft" : "Save private draft"}</button>
                  <button className="primary-button" type="button" onClick={() => void save("published")} disabled={saving}>{saving ? <LoaderCircle className="admin-spinner" /> : <Send />} Publish new version</button>
                  <Link className="admin-policy-preview" href={`/policies/${selected.policy_key}`} target="_blank"><Eye /> Open public page</Link>
                </div>
              </form>
            ) : <div className="admin-empty-panel"><BookOpenCheck /><h2>No policy selected</h2><p>Choose a policy document to edit it.</p></div>}

            {selected ? (
              <div className="admin-policy-history">
                <header><div><p className="eyebrow">Audit trail</p><h2>Revision history</h2></div><span>{revisions.length} saved version{revisions.length === 1 ? "" : "s"}</span></header>
                <div>{revisions.map((revision) => <article key={revision.id}><Clock3 /><span><strong>Version {revision.version} · {revision.status}</strong><small>{formatPolicyDate(revision.changed_at)}</small></span></article>)}</div>
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  );
}

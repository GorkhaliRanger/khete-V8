"use client";
/* eslint-disable @next/next/no-img-element -- Admin previews use dynamically uploaded Supabase image URLs. */

import { useEffect, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import {
  DEFAULT_HOME_AD_BANNER,
  HOME_AD_BANNER_BUCKET,
  HOME_AD_BANNER_KEY,
  parseHomeAdBanner,
  validateHomeAdBanner,
  type HomeAdBanner,
} from "@/lib/home-ad-banner";
import { createClient } from "@/lib/supabase/admin-client";

const fieldStyle = { display: "grid", gap: 6, fontSize: ".76rem", fontWeight: 700 } as const;
const inputStyle = { minHeight: 40, padding: "8px 11px", border: "1px solid var(--line)", borderRadius: 9, fontWeight: 400 } as const;

async function readBanner(): Promise<HomeAdBanner> {
  const { data, error } = await createClient()
    .from("site_content")
    .select("value_en")
    .eq("key", HOME_AD_BANNER_KEY)
    .maybeSingle();
  if (error) throw error;
  return data?.value_en ? parseHomeAdBanner(data.value_en) : DEFAULT_HOME_AD_BANNER;
}

export function AdminHomeAdEditor() {
  const [draft, setDraft] = useState<HomeAdBanner>(DEFAULT_HOME_AD_BANNER);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      setDraft(await readBanner());
      setSelectedFile(null);
      setPreviewUrl("");
      setLoadFailed(false);
      setError("");
    } catch (failure) {
      setLoadFailed(true);
      setError(failure instanceof Error ? failure.message : "The banner could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    void readBanner().then((banner) => {
      if (!mounted) return;
      setDraft(banner);
      setLoading(false);
    }).catch((failure) => {
      if (!mounted) return;
      setLoadFailed(true);
      setError(failure instanceof Error ? failure.message : "The banner could not be loaded.");
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const reload = () => {
    setLoading(true);
    setLoadFailed(false);
    setError("");
    void load();
  };

  const change = <K extends keyof HomeAdBanner>(key: K, value: HomeAdBanner[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice("");
  };

  const chooseImage = (file: File) => {
    const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    const extension = extensions[file.type];
    if (!extension) { setError("Choose a JPEG, PNG or WebP image."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Choose an image smaller than 5 MB."); return; }
    setError("");
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setNotice(`Image ready (${extension.toUpperCase()}). Save the banner to upload and publish it.`);
  };

  const save = async () => {
    const validationError = validateHomeAdBanner(draft);
    if (validationError) { setError(validationError); return; }
    setSaving(true);
    setError("");
    setNotice("");
    let uploadedPath = "";
    try {
      const normalized = parseHomeAdBanner(draft);
      if (selectedFile) {
        setUploading(true);
        const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
        const path = `home-ad-banner/${crypto.randomUUID()}.${extensions[selectedFile.type]}`;
        const { error: uploadError } = await createClient().storage.from(HOME_AD_BANNER_BUCKET)
          .upload(path, selectedFile, { contentType: selectedFile.type, cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
        uploadedPath = path;
        normalized.imagePath = uploadedPath;
        setUploading(false);
      }
      const { data, error: saveError } = await createClient().from("site_content")
        .upsert({ key: HOME_AD_BANNER_KEY, value_en: JSON.stringify(normalized), value_ne: null, updated_at: new Date().toISOString() }, { onConflict: "key" })
        .select("value_en")
        .single();
      if (saveError) throw saveError;
      if (!data) throw new Error("The banner save did not return a record.");
      setDraft(parseHomeAdBanner(data.value_en));
      setSelectedFile(null);
      setPreviewUrl("");
      setNotice("Promotional banner saved. It is now available on the homepage.");
    } catch (failure) {
      if (uploadedPath) {
        try { await createClient().storage.from(HOME_AD_BANNER_BUCKET).remove([uploadedPath]); }
        catch { /* Leave the save error visible if temporary cleanup also fails. */ }
      }
      setError(failure instanceof Error ? failure.message : "The banner could not be saved.");
    } finally {
      setUploading(false);
      setSaving(false);
    }
  };

  let imageUrl = "";
  if (draft.imagePath) {
    try { imageUrl = createClient().storage.from(HOME_AD_BANNER_BUCKET).getPublicUrl(draft.imagePath).data.publicUrl; }
    catch { /* Keep the draft and show its upload path below. */ }
  }

  return (
    <section className="admin-form" style={{ marginBottom: 22, display: "grid", gap: 14 }} aria-labelledby="home-ad-heading">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 id="home-ad-heading" style={{ margin: 0, fontSize: "1.05rem" }}>Homepage advertisement banner</h2>
          <p style={{ margin: "5px 0 0", color: "var(--muted)", fontSize: ".78rem", lineHeight: 1.6 }}>Edit the full-width banner near the bottom of the homepage. Changes appear after Save.</p>
        </div>
        <button className="secondary-button" type="button" onClick={reload} disabled={loading || saving || uploading} style={{ minHeight: 38 }}><RefreshCw size={16} /> Reload</button>
      </div>

      {loading ? <p style={{ margin: 0, color: "var(--muted)" }}><LoaderCircle className="admin-spinner" /> Loading banner…</p> : loadFailed ? null : (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: ".8rem", fontWeight: 700 }}>
            <input type="checkbox" checked={draft.enabled} onChange={(event) => change("enabled", event.target.checked)} /> Show this banner on the homepage
          </label>
          <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
            <label style={fieldStyle}>Small label
              <input style={inputStyle} maxLength={50} value={draft.eyebrow} onChange={(event) => change("eyebrow", event.target.value)} placeholder="Shop with confidence" />
            </label>
            <label style={fieldStyle}>Headline
              <input style={inputStyle} maxLength={90} required value={draft.headline} onChange={(event) => change("headline", event.target.value)} placeholder="Delivery that fits" />
            </label>
          </div>
          <label style={fieldStyle}>Banner text
            <textarea style={{ ...inputStyle, resize: "vertical" }} rows={3} maxLength={240} required value={draft.body} onChange={(event) => change("body", event.target.value)} />
          </label>
          <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
            <label style={fieldStyle}>Button label <span style={{ color: "var(--muted)", fontWeight: 400 }}>Leave blank to hide the button.</span>
              <input style={inputStyle} maxLength={40} value={draft.buttonLabel} onChange={(event) => change("buttonLabel", event.target.value)} placeholder="Explore marketplace" />
            </label>
            <label style={fieldStyle}>Button link <span style={{ color: "var(--muted)", fontWeight: 400 }}>Local path or secure https:// address.</span>
              <input style={inputStyle} maxLength={300} value={draft.buttonHref} onChange={(event) => change("buttonHref", event.target.value)} placeholder="/products" />
            </label>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={(event) => { const file = event.target.files?.[0]; if (file) chooseImage(file); event.target.value = ""; }} />
            <button className="secondary-button" type="button" disabled={uploading || saving} onClick={() => fileInput.current?.click()} style={{ minHeight: 40 }}>
              {uploading ? <LoaderCircle className="admin-spinner" /> : <ImagePlus />} {previewUrl || imageUrl ? "Replace banner image" : "Choose banner image"}
            </button>
            {previewUrl || imageUrl ? <>
              <img src={previewUrl || imageUrl} alt="Current banner draft" style={{ width: 104, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
              <button className="icon-button" type="button" onClick={() => { setSelectedFile(null); setPreviewUrl(""); change("imagePath", ""); }} disabled={uploading || saving} aria-label="Remove banner image" title="Remove image"><Trash2 /></button>
            </> : <span style={{ color: "var(--muted)", fontSize: ".75rem" }}>Optional. The white khetE logo appears when no image is used.</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button className="primary-button" type="button" disabled={saving || uploading} onClick={() => void save()} style={{ minHeight: 40 }}>{saving ? <LoaderCircle className="admin-spinner" /> : null} Save banner</button>
            {notice ? <span role="status" style={{ color: "var(--green-650)", fontSize: ".78rem" }}>{notice}</span> : null}
          </div>
        </>
      )}
      {error ? <p role="alert" style={{ margin: 0, color: "#b3411e", fontSize: ".78rem" }}>{error}</p> : null}
    </section>
  );
}

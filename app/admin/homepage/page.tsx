"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, ImagePlus, LoaderCircle, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { AdminAccessCard, type AdminAccessState } from "@/components/admin-access-card";
import { AdminHomeAdEditor } from "@/components/admin-home-ad-editor";
import { AdminSidebar } from "@/components/admin-sidebar";
import { createClient } from "@/lib/supabase/admin-client";

type HighlightSection = "deals" | "featured" | "popular";

type PickListing = {
  id: string;
  slug: string;
  name_en: string;
  kind: string;
  status: string;
};

type HighlightPick = {
  id: string;
  section: HighlightSection;
  listingId: string;
  position: number;
  badge: string;
  headline: string;
  description: string;
  imagePath: string;
};

const manageRoles = new Set(["super_admin", "content_promotion_manager", "product_inventory_manager"]);

const sectionMeta: { id: HighlightSection; title: string; description: string }[] = [
  { id: "deals", title: "khetE's Deals", description: "Attractive deal cards in the horizontally scrolling “Deals of the Day” strip. You can give each deal its own badge, headline, short description and image. Clicking a card opens the product pinned at the top of its category. Falls back to listings with offers or discounted prices until you pick some." },
  { id: "featured", title: "Featured Products", description: "Large promotional tiles on the homepage (badge, headline, description, image and call-to-action — like a curated showcase). Clicking a tile opens the product pinned at the top of its category. Falls back to listings with the “Feature on homepage” toggle until you pick some." },
  { id: "popular", title: "khetE's Most Popular", description: "Product grid on the homepage. Falls back to the daily automatic rotation until you pick some." },
];

const setupSql = `create table if not exists public.home_highlights (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('deals', 'featured', 'popular')),
  listing_id uuid not null references public.listings(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (section, listing_id)
);

create index if not exists home_highlights_section_position_idx
  on public.home_highlights (section, position);

create or replace function private.can_manage_home_highlights()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role in ('super_admin', 'product_inventory_manager', 'content_promotion_manager')
  );
$$;

grant execute on function private.can_manage_home_highlights() to authenticated;

alter table public.home_highlights enable row level security;

create policy "home_highlights_are_public"
on public.home_highlights for select to anon, authenticated
using (true);

create policy "home_highlights_admin_insert"
on public.home_highlights for insert to authenticated
with check (private.can_manage_home_highlights());

create policy "home_highlights_admin_update"
on public.home_highlights for update to authenticated
using (private.can_manage_home_highlights())
with check (private.can_manage_home_highlights());

create policy "home_highlights_admin_delete"
on public.home_highlights for delete to authenticated
using (private.can_manage_home_highlights());

grant select on public.home_highlights to anon, authenticated;
grant insert, update, delete on public.home_highlights to authenticated;

-- Promo details for the Deals and Featured tiles (badge, headline, description, image).
alter table public.home_highlights
  add column if not exists badge text,
  add column if not exists headline text,
  add column if not exists description text,
  add column if not exists image_path text;`;

function isMissingTableError(value: unknown) {
  const message = value instanceof Error ? value.message : String(value ?? "");
  const normalized = message.toLowerCase();
  return normalized.includes("relation") || normalized.includes("does not exist") || normalized.includes("schema cache");
}

export default function AdminHomepagePage() {
  const [access, setAccess] = useState<AdminAccessState>("loading");
  const [accountEmail, setAccountEmail] = useState("");
  const [detectedRoles, setDetectedRoles] = useState<string[]>([]);
  const [currentOrigin, setCurrentOrigin] = useState("");
  const [listings, setListings] = useState<PickListing[]>([]);
  const [picks, setPicks] = useState<HighlightPick[]>([]);
  const [tableMissing, setTableMissing] = useState(false);
  const [drafts, setDrafts] = useState<Record<HighlightSection, string>>({ deals: "", featured: "", popular: "" });
  const [editingId, setEditingId] = useState("");
  const [editDraft, setEditDraft] = useState({ badge: "", headline: "", description: "", imagePath: "" });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadPicks = useCallback(async () => {
    const supabase = createClient();
    const { data, error: picksError } = await supabase
      .from("home_highlights")
      .select("id, section, listing_id, position, badge, headline, description, image_path")
      .order("position", { ascending: true });
    if (picksError) {
      if (isMissingTableError(picksError) || (picksError.message ?? "").includes("column")) setTableMissing(true);
      throw picksError;
    }
    setTableMissing(false);
    setPicks(((data ?? []) as { id: string; section: HighlightSection; listing_id: string; position: number; badge: string | null; headline: string | null; description: string | null; image_path: string | null }[]).map((row) => ({
      id: row.id,
      section: row.section,
      listingId: row.listing_id,
      position: row.position,
      badge: row.badge ?? "",
      headline: row.headline ?? "",
      description: row.description ?? "",
      imagePath: row.image_path ?? "",
    })));
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
        if (!roleNames.some((role) => manageRoles.has(role))) {
          if (mounted) setAccess("denied");
          return;
        }
        const { data: listingData, error: listingError } = await supabase
          .from("listings")
          .select("id, slug, name_en, kind, status")
          .order("name_en", { ascending: true });
        if (listingError) throw listingError;
        if (mounted) setListings((listingData ?? []) as PickListing[]);
        try {
          await loadPicks();
        } catch (loadError) {
          if (!isMissingTableError(loadError)) throw loadError;
          if (mounted) setTableMissing(true);
        }
        if (mounted) setAccess("allowed");
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "The homepage highlights workspace could not be loaded.");
          setAccess("error");
        }
      }
    };
    void checkAccess();
    return () => { mounted = false; };
  }, [loadPicks]);

  const picksFor = (section: HighlightSection) => picks.filter((pick) => pick.section === section);

  const run = async (action: () => Promise<unknown>, success: string) => {
    if (saving) return;
    setSaving(true);
    setNotice("");
    setError("");
    try {
      await action();
      await loadPicks();
      setNotice(success);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "That change could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const addPick = (section: HighlightSection) => {
    const listingId = drafts[section];
    if (!listingId) return;
    void run(async () => {
      const supabase = createClient();
      const { error: insertError } = await supabase.from("home_highlights").insert({
        section,
        listing_id: listingId,
        position: picksFor(section).length * 10 + 10,
      });
      if (insertError) throw insertError;
      setDrafts((current) => ({ ...current, [section]: "" }));
    }, "Highlight added.");
  };

  const removePick = (pick: HighlightPick) => {
    void run(async () => {
      const supabase = createClient();
      const { error: deleteError } = await supabase.from("home_highlights").delete().eq("id", pick.id);
      if (deleteError) throw deleteError;
    }, "Highlight removed.");
  };

  const movePick = (section: HighlightSection, index: number, direction: -1 | 1) => {
    const rows = picksFor(section);
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const reordered = [...rows];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    void run(async () => {
      const supabase = createClient();
      for (let position = 0; position < reordered.length; position += 1) {
        const { error: updateError } = await supabase
          .from("home_highlights")
          .update({ position: (position + 1) * 10 })
          .eq("id", reordered[position].id);
        if (updateError) throw updateError;
      }
    }, "Order updated.");
  };

  const startEditing = (pick: HighlightPick) => {
    setEditingId(pick.id);
    setEditDraft({ badge: pick.badge, headline: pick.headline, description: pick.description, imagePath: pick.imagePath });
  };

  const savePromo = (pick: HighlightPick) => {
    void run(async () => {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("home_highlights")
        .update({
          badge: editDraft.badge.trim() || null,
          headline: editDraft.headline.trim() || null,
          description: editDraft.description.trim() || null,
          image_path: editDraft.imagePath || null,
        })
        .eq("id", pick.id);
      if (updateError) throw updateError;
      setEditingId("");
    }, "Highlight details saved.");
  };

  const uploadPromoImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Images must be 5 MB or smaller.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const supabase = createClient();
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `home-highlights/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("marketplace-media").upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      setEditDraft((current) => ({ ...current, imagePath: path }));
      setNotice("Image uploaded — remember to Save the highlight.");
    } catch (uploadFailure) {
      setError(uploadFailure instanceof Error ? uploadFailure.message : "The image could not be uploaded.");
    } finally {
      setUploading(false);
    }
  };

  if (access !== "allowed") {
    return <AdminAccessCard access={access} error={error} email={accountEmail} roles={detectedRoles} origin={currentOrigin} resource="homepage highlights" requirement="the Super Admin, Content & Promotion Manager or Product & Inventory Manager role" returnTo="/admin/homepage" />;
  }

  const listingName = (id: string) => listings.find((listing) => listing.id === id)?.name_en ?? "Unknown listing";

  return (
    <main className="admin-shell admin-homepage-page">
      <AdminSidebar active="homepage" />
      <section className="admin-main">
        <header className="admin-page-heading">
          <div>
            <p className="eyebrow">Storefront</p>
            <h1>Homepage Highlights &amp; Promotions</h1>
            <p>Choose homepage listings and, if you manage content, edit the promotional banner. Empty listing sections use their automatic behaviour.</p>
          </div>
          <div className="admin-create-actions">
            <button type="button" onClick={() => void run(loadPicks, "Refreshed.")} disabled={saving || tableMissing}><RefreshCw /> Refresh</button>
          </div>
        </header>

        {detectedRoles.some((role) => role === "super_admin" || role === "content_promotion_manager") ? <AdminHomeAdEditor /> : null}

        {tableMissing ? (
          <div className="admin-form" style={{ display: "grid", gap: 14, marginBottom: 22 }}>
            <h2 style={{ margin: 0, fontSize: "1.05rem" }}>One-time database setup needed</h2>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: ".8rem", lineHeight: 1.6 }}>The highlights table has not been added to the database yet. Open the Supabase dashboard → SQL Editor, paste the SQL below, run it, then choose Refresh. The same migration is saved at <code>supabase/migrations/202610100018_home_highlights.sql</code> in the project.</p>
            <div>
              <button
                className="primary-button"
                type="button"
                onClick={() => void navigator.clipboard?.writeText(setupSql).then(() => setNotice("SQL copied to clipboard."))}
              >
                <Copy /> Copy setup SQL
              </button>
            </div>
          </div>
        ) : (
          sectionMeta.map((section) => {
            const rows = picksFor(section.id);
            const available = listings.filter((listing) => !rows.some((pick) => pick.listingId === listing.id));
            return (
              <div className="admin-form" key={section.id} style={{ marginBottom: 22, display: "grid", gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{section.title}</h2>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: ".78rem", lineHeight: 1.6 }}>{section.description}</p>
                <div className="form-grid" style={{ gridTemplateColumns: "minmax(260px, 420px) auto auto", alignItems: "end" }}>
                  <label>
                    Pick a listing
                    <select
                      value={drafts[section.id]}
                      onChange={(event) => setDrafts((current) => ({ ...current, [section.id]: event.target.value }))}
                    >
                      <option value="">Choose a listing…</option>
                      {available.map((listing) => (
                        <option key={listing.id} value={listing.id}>
                          {listing.name_en} ({listing.kind}{listing.status !== "published" ? ` · ${listing.status}` : ""})
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="primary-button" type="button" onClick={() => addPick(section.id)} disabled={saving || !drafts[section.id] || rows.length >= (section.id === "deals" ? 5 : 4)}>
                    <Plus /> Add highlight
                  </button>
                  <span style={{ color: "var(--muted)", fontSize: ".78rem", paddingBottom: 13 }}>{rows.length}/{section.id === "deals" ? 5 : 4} chosen</span>
                </div>
                {rows.length ? (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                    {rows.map((pick, index) => (
                      <li key={pick.id} style={{ padding: "9px 12px", background: "var(--green-50)", border: "1px solid var(--line)", borderRadius: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <strong style={{ fontSize: ".85rem" }}>{index + 1}. {listingName(pick.listingId)}</strong>
                          {pick.badge || pick.headline || pick.imagePath ? <span style={{ color: "var(--green-650)", fontSize: ".68rem", fontWeight: 700 }}>customized</span> : null}
                          <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                            <button className="icon-button" type="button" onClick={() => (editingId === pick.id ? setEditingId("") : startEditing(pick))} disabled={saving} aria-label="Edit highlight details" title="Badge, headline, description, image"><Pencil /></button>
                            <button className="icon-button" type="button" onClick={() => movePick(section.id, index, -1)} disabled={saving || index === 0} aria-label="Move up"><ArrowUp /></button>
                            <button className="icon-button" type="button" onClick={() => movePick(section.id, index, 1)} disabled={saving || index === rows.length - 1} aria-label="Move down"><ArrowDown /></button>
                            <button className="icon-button" type="button" onClick={() => removePick(pick)} disabled={saving} aria-label="Remove"><Trash2 /></button>
                          </span>
                        </div>
                        {editingId === pick.id ? (
                          <div style={{ marginTop: 12, padding: 14, display: "grid", gap: 10, background: "white", border: "1px solid var(--line)", borderRadius: 10 }}>
                            <div className="form-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
                              <label style={{ display: "grid", gap: 5, fontSize: ".72rem", fontWeight: 700 }}>
                                Badge text <small style={{ color: "var(--muted)", fontWeight: 400 }}>e.g. “Flat 20% OFF”, “New Arrival”</small>
                                <input value={editDraft.badge} onChange={(event) => setEditDraft((current) => ({ ...current, badge: event.target.value }))} placeholder="Deal of the day" style={{ minHeight: 40, padding: "0 11px", border: "1px solid var(--line)", borderRadius: 9 }} />
                              </label>
                              <label style={{ display: "grid", gap: 5, fontSize: ".72rem", fontWeight: 700 }}>
                                Headline <small style={{ color: "var(--muted)", fontWeight: 400 }}>defaults to the listing name</small>
                                <input value={editDraft.headline} onChange={(event) => setEditDraft((current) => ({ ...current, headline: event.target.value }))} placeholder={listingName(pick.listingId)} style={{ minHeight: 40, padding: "0 11px", border: "1px solid var(--line)", borderRadius: 9 }} />
                              </label>
                            </div>
                            <label style={{ display: "grid", gap: 5, fontSize: ".72rem", fontWeight: 700 }}>
                              Short description <small style={{ color: "var(--muted)", fontWeight: 400 }}>one or two lines shown on the tile</small>
                              <textarea rows={2} value={editDraft.description} onChange={(event) => setEditDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Why this product is worth a look…" style={{ padding: "9px 11px", border: "1px solid var(--line)", borderRadius: 9, resize: "vertical" }} />
                            </label>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadPromoImage(file); event.target.value = ""; }} />
                              <button className="secondary-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ minHeight: 38 }}>
                                {uploading ? <LoaderCircle className="admin-spinner" /> : <ImagePlus />} {editDraft.imagePath ? "Replace image" : "Upload image"}
                              </button>
                              {editDraft.imagePath ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of the uploaded highlight image */}
                                  <img src={createClient().storage.from("marketplace-media").getPublicUrl(editDraft.imagePath).data.publicUrl} alt="Highlight preview" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 9, border: "1px solid var(--line)" }} />
                                  <button className="icon-button" type="button" onClick={() => setEditDraft((current) => ({ ...current, imagePath: "" }))} aria-label="Remove image" title="Use the listing photo instead"><X /></button>
                                </>
                              ) : (
                                <span style={{ color: "var(--muted)", fontSize: ".72rem" }}>No custom image — the listing photo is used.</span>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button className="primary-button" type="button" onClick={() => savePromo(pick)} disabled={saving || uploading} style={{ minHeight: 40 }}>Save highlight</button>
                              <button className="secondary-button" type="button" onClick={() => setEditingId("")} disabled={saving} style={{ minHeight: 40 }}>Cancel</button>
                            </div>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ margin: 0, color: "var(--muted)", fontSize: ".8rem" }}>No picks yet — the section uses its automatic fallback.</p>
                )}
              </div>
            );
          })
        )}

        {saving ? <p style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--muted)", fontSize: ".8rem" }}><LoaderCircle className="admin-spinner" /> Saving…</p> : null}
        {notice ? <p style={{ color: "var(--green-650)", fontSize: ".8rem" }}>{notice}</p> : null}
        {error ? <p style={{ color: "#b3411e", fontSize: ".8rem" }}>{error}</p> : null}
      </section>
    </main>
  );
}

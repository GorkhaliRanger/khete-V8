"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowDown, RefreshCw, Search } from "lucide-react";
import { AdminAccessCard, type AdminAccessState } from "@/components/admin-access-card";
import { AdminSidebar } from "@/components/admin-sidebar";
import { createClient } from "@/lib/supabase/admin-client";

type ActivityEvent = {
  id: number;
  actor_user_id: string;
  actor_email: string;
  actor_name: string;
  actor_roles: string[];
  area: string;
  entity_table: string;
  entity_key: Record<string, unknown>;
  entity_label: string | null;
  operation: "INSERT" | "UPDATE" | "DELETE";
  changed_fields: string[];
  safe_changes: Record<string, { before: unknown; after: unknown }>;
  recorded_at: string;
};

type Filters = { search: string; area: string; from: string; to: string };
const emptyFilters: Filters = { search: "", area: "", from: "", to: "" };
const pageSize = 50;
const areas = [
  ["", "All areas"], ["team", "Team access"], ["catalog", "Catalog & stock"],
  ["orders", "Orders"], ["support", "Support"], ["network", "Professional network"],
  ["finance", "Professional finance"], ["promotions", "Promotions"],
  ["homepage", "Homepage"], ["content", "Policies & content"],
  ["certificates", "Certificates"], ["reviews", "Reviews"],
] as const;

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-NP", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu",
  }).format(new Date(value));
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(String).join(", ") || "—";
  if (typeof value === "object") return "Updated";
  const content = String(value);
  return content.length > 100 ? `${content.slice(0, 97)}…` : content;
}

function formatKey(key: Record<string, unknown>) {
  return Object.entries(key).map(([field, value]) => `${humanize(field)}: ${String(value)}`).join(" · ");
}

function fromLocalDay(value: string) {
  return value ? new Date(`${value}T00:00:00+05:45`).toISOString() : null;
}

function untilLocalDay(value: string) {
  if (!value) return null;
  const next = new Date(`${value}T00:00:00+05:45`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

export default function AdminActivityPage() {
  const [access, setAccess] = useState<AdminAccessState>("loading");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [origin] = useState(() => typeof window === "undefined" ? "" : window.location.origin);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (nextFilters: Filters, beforeId?: number) => {
    setLoading(true);
    setError("");
    try {
      const { data, error: feedError } = await createClient().rpc("admin_activity_feed", {
        p_search: nextFilters.search.trim() || null,
        p_area: nextFilters.area || null,
        p_from: fromLocalDay(nextFilters.from),
        p_to: untilLocalDay(nextFilters.to),
        p_before_id: beforeId ?? null,
        p_limit: pageSize,
      });
      if (feedError) throw feedError;
      const rows = (data ?? []) as ActivityEvent[];
      setEvents((current) => beforeId ? [...current, ...rows] : rows);
      setHasMore(rows.length === pageSize);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Admin activity could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function checkAccess() {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) {
        setAccess("signed-out");
        return;
      }
      setEmail(authData.user.email ?? "");
      const [roleResult, profileResult] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", authData.user.id),
        supabase.from("admin_profiles").select("is_active").eq("user_id", authData.user.id).maybeSingle(),
      ]);
      if (!active) return;
      if (roleResult.error || profileResult.error) {
        setError(roleResult.error?.message || profileResult.error?.message || "Access check failed.");
        setAccess("error");
        return;
      }
      const currentRoles = (roleResult.data ?? []).map((row) => String(row.role));
      setRoles(currentRoles);
      if (!currentRoles.includes("super_admin") || !profileResult.data?.is_active) {
        setAccess("denied");
        return;
      }
      setAccess("allowed");
      await load(emptyFilters);
    }
    void checkAccess();
    return () => { active = false; };
  }, [load]);

  function applyFilters() {
    setFilters(draft);
    void load(draft);
  }

  if (access !== "allowed") {
    return <AdminAccessCard access={access} error={error} email={email} roles={roles} origin={origin} resource="Admin activity" requirement="an active Super Admin account" returnTo="/admin/activity" />;
  }

  return (
    <div className="admin-shell admin-activity-page">
      <AdminSidebar active="activity" roles={roles} />
      <main className="admin-main">
        <header className="admin-page-heading">
          <div><p className="eyebrow">Accountability</p><h1>Admin activity</h1><p>See who changed a record and when. Private customer details, support messages and passwords are kept out of this trail.</p></div>
          <button className="secondary-button" type="button" onClick={() => void load(filters)} disabled={loading}><RefreshCw /> Refresh</button>
        </header>

        <form className="admin-activity-filters" onSubmit={(event) => { event.preventDefault(); applyFilters(); }}>
          <label className="admin-activity-search"><span>Person or record</span><input value={draft.search} onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))} placeholder="Name, email, record ID…" /></label>
          <label><span>Area</span><select value={draft.area} onChange={(event) => setDraft((current) => ({ ...current, area: event.target.value }))}>{areas.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label><span>From</span><input type="date" value={draft.from} max={draft.to || undefined} onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))} /></label>
          <label><span>Through</span><input type="date" value={draft.to} min={draft.from || undefined} onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))} /></label>
          <button className="primary-button" type="submit" disabled={loading}><Search /> Search</button>
        </form>

        {error ? <p className="admin-notice admin-error-notice" role="alert">{error}</p> : null}
        <section className="admin-activity-list" aria-label="Admin activity events">
          <div className="admin-activity-list-heading"><Activity /><div><h2>Recorded changes</h2><p>Times shown in Nepal time. New changes appear after refresh.</p></div><span>{events.length} shown</span></div>
          {events.map((event) => <article className="admin-activity-event" key={event.id}>
            <div className="admin-activity-event-main">
              <span className={`admin-activity-operation admin-activity-${event.operation.toLowerCase()}`}>{event.operation === "INSERT" ? "Created" : event.operation === "DELETE" ? "Deleted" : "Changed"}</span>
              <div><h3>{humanize(event.entity_table)}{event.entity_label ? ` · ${event.entity_label}` : ""}</h3><p>{areas.find(([value]) => value === event.area)?.[1] ?? humanize(event.area)} · {formatKey(event.entity_key)}</p></div>
              <time dateTime={event.recorded_at}>{formatTime(event.recorded_at)}</time>
            </div>
            <div className="admin-activity-event-detail">
              <div className="admin-activity-actor"><strong>{event.actor_name}</strong><span>{event.actor_email}</span><small>{event.actor_roles.map(humanize).join(", ")}</small></div>
              <div className="admin-activity-changes">
                {event.changed_fields.length ? event.changed_fields.map((field) => {
                  const detail = event.safe_changes?.[field];
                  return <span key={field}><strong>{humanize(field)}</strong>{detail ? <small>{formatValue(detail.before)} → {formatValue(detail.after)}</small> : <small>Changed; value hidden</small>}</span>;
                }) : <span>No public field details</span>}
              </div>
            </div>
          </article>)}
          {!events.length && !loading && !error ? <div className="admin-activity-empty"><Activity /><h2>No recorded changes</h2><p>New Admin changes appear here. Earlier edits cannot be reconstructed; try a different person or date range.</p></div> : null}
        </section>
        {loading ? <p className="admin-activity-status" role="status">Loading activity…</p> : null}
        {hasMore && !loading ? <button className="admin-activity-more secondary-button" type="button" onClick={() => void load(filters, events.at(-1)?.id)}><ArrowDown /> Load older changes</button> : null}
      </main>
    </div>
  );
}

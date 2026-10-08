"use client";

import Link from "next/link";
import { LoaderCircle, Search, UserRoundPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  pluralProfessionalRole,
  professionalError,
  professionalProfileSelect,
  professionalRoles,
  type ProfessionalProfile,
  type ProfessionalRole,
} from "@/lib/professional-network";
import { createClient } from "@/lib/supabase/client";
import { ExpertCard } from "./expert-card";

type RoleFilter = "all" | ProfessionalRole;

const roleDescriptions: Record<ProfessionalRole, string> = {
  advisor: "Strategic and subject guidance",
  expert_professional: "Specialist technical support",
  associate_partner: "Organisations working with the network",
};

export function ExpertDirectory() {
  const [experts, setExperts] = useState<ProfessionalProfile[]>([]);
  const [activeRole, setActiveRole] = useState<RoleFilter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const requestedRole = new URLSearchParams(window.location.search).get("role");
    if (professionalRoles.includes(requestedRole as ProfessionalRole)) {
      queueMicrotask(() => setActiveRole(requestedRole as ProfessionalRole));
    }
    let mounted = true;
    const load = async () => {
      try {
        const supabase = createClient();
        const { data, error: loadError } = await supabase
          .from("professional_profiles")
          .select(professionalProfileSelect)
          .eq("status", "active")
          .order("featured", { ascending: false })
          .order("sort_order", { ascending: true })
          .order("published_at", { ascending: false });
        if (loadError) throw loadError;
        if (mounted) setExperts((data ?? []) as unknown as ProfessionalProfile[]);
      } catch (caught) {
        if (mounted) setError(professionalError(caught));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const visibleExperts = useMemo(
    () => experts.filter((expert) => {
      if (activeRole !== "all" && expert.role !== activeRole) return false;
      const needle = query.trim().toLowerCase();
      if (!needle) return true;
      return [
        expert.name,
        expert.position_title,
        expert.organization_name ?? "",
        expert.location,
        expert.summary,
        ...expert.expertise,
      ].some((value) => value.toLowerCase().includes(needle));
    }),
    [activeRole, experts, query],
  );

  return (
    <>
      <div className="expert-role-summary" aria-label="Filter the professional network by role">
        {professionalRoles.map((role) => {
          const count = experts.filter((expert) => expert.role === role).length;
          const active = activeRole === role;
          return (
            <button className={active ? "is-active" : ""} type="button" aria-pressed={active} onClick={() => setActiveRole(active ? "all" : role)} key={role}>
              <strong>{pluralProfessionalRole(role)}<small>{count}</small></strong>
              <span>{roleDescriptions[role]}</span>
            </button>
          );
        })}
      </div>
      <div className="expert-directory-search">
        <Search />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, expertise or location…" />
      </div>
      <div className="expert-directory-status">
        <p>{activeRole === "all" ? `Showing the full network (${visibleExperts.length})` : `Showing ${pluralProfessionalRole(activeRole)} (${visibleExperts.length})`}</p>
        {activeRole !== "all" ? <button type="button" onClick={() => setActiveRole("all")}>Show full network</button> : null}
      </div>
      <div className="experts-grid" id="professional-network-results" aria-live="polite">
        {loading ? <div className="expert-directory-empty"><LoaderCircle className="admin-spinner" /><strong>Loading verified profiles…</strong></div> : null}
        {!loading && error ? <div className="expert-directory-empty"><strong>Professional Network is being prepared.</strong><p>{error}</p><Link href="/support?type=seller_application">Contact Support</Link></div> : null}
        {!loading && !error && !visibleExperts.length ? <div className="expert-directory-empty"><UserRoundPlus /><strong>No matching profiles yet</strong><p>Approved advisors, professionals and partners will appear here.</p><Link className="primary-button" href="/experts/apply">Apply to join</Link></div> : null}
        {visibleExperts.map((expert) => <ExpertCard expert={expert} key={expert.slug} />)}
      </div>
    </>
  );
}

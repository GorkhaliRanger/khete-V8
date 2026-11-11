"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, CheckCircle2, Clock3, LoaderCircle, MessageSquareText, Search, ShieldAlert, Star, XCircle } from "lucide-react";
import { AdminAccessCard, type AdminAccessState } from "@/components/admin-access-card";
import { AdminSidebar } from "@/components/admin-sidebar";
import { ReviewStars } from "@/components/review-stars";
import {
  formatReviewDate,
  labelReviewStatus,
  marketplaceReviewSelect,
  reviewError,
  type MarketplaceReview,
  type ReviewKind,
  type ReviewStatus,
} from "@/lib/reviews";
import { createClient } from "@/lib/supabase/admin-client";

const permittedRoles = new Set([
  "super_admin",
  "product_inventory_manager",
  "customer_support",
  "content_promotion_manager",
]);

type AdminReview = MarketplaceReview & {
  listings: { name_en: string } | null;
  professional_profiles: { name: string } | null;
  professional_offerings: { title: string } | null;
};

function reviewSubject(review: AdminReview) {
  if (review.kind === "product") return review.listings?.name_en ?? "Product listing";
  return review.professional_profiles?.name ?? "Professional service";
}

export default function AdminReviewsPage() {
  const [access, setAccess] = useState<AdminAccessState>("loading");
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ReviewStatus>("pending");
  const [kindFilter, setKindFilter] = useState<"all" | ReviewKind>("all");
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const selectedIdRef = useRef("");

  const selectReview = useCallback((review: AdminReview, clearFeedback = true) => {
    selectedIdRef.current = review.id;
    setSelectedId(review.id);
    setNote(review.admin_note ?? "");
    if (clearFeedback) {
      setError("");
      setMessage("");
    }
  }, []);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data, error: loadError } = await supabase
        .from("marketplace_reviews")
        .select(`${marketplaceReviewSelect},listings(name_en),professional_profiles(name),professional_offerings(title)`)
        .order("created_at", { ascending: true });
      if (loadError) throw loadError;
      const rows = (data ?? []) as unknown as AdminReview[];
      setReviews(rows);
      const nextSelected = rows.find((review) => review.id === selectedIdRef.current)
        ?? rows.find((review) => review.status === "pending")
        ?? rows[0];
      if (nextSelected) selectReview(nextSelected, false);
      else {
        selectedIdRef.current = "";
        setSelectedId("");
      }
    } catch (caught) {
      const text = reviewError(caught);
      setError(text.includes("schema cache") || text.includes("relation")
        ? "Run the Verified Reviews migration in Supabase to activate this workspace."
        : text);
    } finally {
      setLoading(false);
    }
  }, [selectReview]);

  useEffect(() => {
    const verify = async () => {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setAccess("signed-out");
        return;
      }
      const { data: roles, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id);
      if (roleError || !(roles ?? []).some((item) => permittedRoles.has(String(item.role)))) {
        setAccess("denied");
        return;
      }
      setAccess("allowed");
      await loadReviews();
    };
    void verify();
  }, [loadReviews]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return reviews.filter((review) => {
      if (statusFilter !== "all" && review.status !== statusFilter) return false;
      if (kindFilter !== "all" && review.kind !== kindFilter) return false;
      if (!needle) return true;
      return [
        review.reviewer_name,
        review.title ?? "",
        review.body,
        reviewSubject(review),
        review.professional_offerings?.title ?? "",
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [kindFilter, query, reviews, statusFilter]);

  const selected = reviews.find((review) => review.id === selectedId) ?? null;

  const moderate = async (status: "published" | "rejected") => {
    if (!selected) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      const { error: moderationError } = await supabase.rpc("moderate_marketplace_review", {
        p_review_id: selected.id,
        p_status: status,
        p_admin_note: note.trim() || null,
      });
      if (moderationError) throw moderationError;
      setMessage(status === "published" ? "Review published." : "Review returned to the customer.");
      await loadReviews();
    } catch (caught) {
      setError(reviewError(caught));
    } finally {
      setSaving(false);
    }
  };

  if (access !== "allowed") {
    return (
      <main className="admin-shell">
        <AdminSidebar active="reviews" />
        <section className="admin-main">
          <AdminAccessCard
            access={access}
            resource="verified reviews"
            requirement="the Super Admin, Product & Inventory Manager, Customer Support, or Content & Promotion Manager role"
            returnTo="/admin/reviews"
          />
        </section>
      </main>
    );
  }

  const pendingCount = reviews.filter((review) => review.status === "pending").length;
  const publishedCount = reviews.filter((review) => review.status === "published").length;
  const rejectedCount = reviews.filter((review) => review.status === "rejected").length;

  return (
    <main className="admin-shell">
      <AdminSidebar active="reviews" />
      <section className="admin-main admin-reviews-main">
        <header className="admin-page-heading">
          <div><p className="eyebrow">Trust & quality</p><h1>Verified Reviews</h1><p>Moderate feedback from delivered purchases and completed professional services.</p></div>
          <BadgeCheck />
        </header>

        <div className="admin-review-stats">
          <article><Clock3 /><span><small>Pending</small><strong>{pendingCount}</strong></span></article>
          <article><CheckCircle2 /><span><small>Published</small><strong>{publishedCount}</strong></span></article>
          <article><ShieldAlert /><span><small>Changes required</small><strong>{rejectedCount}</strong></span></article>
          <article><Star /><span><small>Total verified</small><strong>{reviews.length}</strong></span></article>
        </div>

        {error && !selected ? <div className="review-notice error">{error}</div> : null}

        <div className="admin-review-workspace">
          <section className="admin-review-queue">
            <div className="admin-review-filters">
              <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Customer, subject or review…" /></label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | ReviewStatus)}>
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="published">Published</option>
                <option value="rejected">Changes required</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
              <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as "all" | ReviewKind)}>
                <option value="all">Products & services</option>
                <option value="product">Products</option>
                <option value="professional_service">Professional services</option>
              </select>
            </div>
            <div className="admin-review-list">
              {loading && !reviews.length ? <div className="admin-list-empty"><LoaderCircle className="admin-spinner" /> Loading reviews…</div> : null}
              {!loading && !filtered.length ? <div className="admin-list-empty"><MessageSquareText /><strong>No matching reviews</strong><span>Change the filters or wait for verified customer feedback.</span></div> : null}
              {filtered.map((review) => (
                <button className={review.id === selectedId ? "selected" : ""} type="button" key={review.id} onClick={() => selectReview(review)}>
                  <span><strong>{reviewSubject(review)}</strong><small>{review.title || review.body.slice(0, 72)}</small><em>{review.reviewer_name} · {formatReviewDate(review.created_at)}</em></span>
                  <span><ReviewStars rating={Number(review.rating)} /><b className={`review-status review-status-${review.status}`}>{labelReviewStatus(review.status)}</b></span>
                </button>
              ))}
            </div>
          </section>

          {selected ? (
            <section className="admin-review-detail">
              <header>
                <div><p className="eyebrow">{selected.kind === "product" ? "Verified purchase" : "Verified professional service"}</p><h2>{reviewSubject(selected)}</h2><p>{selected.professional_offerings?.title || selected.reviewer_name}</p></div>
                <span className={`review-status review-status-${selected.status}`}>{labelReviewStatus(selected.status)}</span>
              </header>
              <div className="admin-review-customer"><span><strong>{selected.reviewer_name}</strong><small>{formatReviewDate(selected.created_at)}</small></span><ReviewStars rating={Number(selected.rating)} /></div>
              {selected.title ? <h3>{selected.title}</h3> : null}
              <blockquote>{selected.body}</blockquote>
              <div className="admin-review-source"><BadgeCheck /><span><strong>Eligibility checked by khetE</strong><small>{selected.kind === "product" ? "Linked to a delivered order item." : "Linked to a completed professional-service request."}</small></span></div>
              <label>Moderation note <small>Visible to the customer when changes are required</small><textarea maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain any required correction clearly." /></label>
              {error ? <div className="review-notice error">{error}</div> : null}
              {message ? <div className="review-notice success">{message}</div> : null}
              <div className="admin-review-actions">
                <button className="danger-button" disabled={saving || selected.status === "withdrawn"} type="button" onClick={() => void moderate("rejected")}><XCircle /> Request changes</button>
                <button className="primary-button" disabled={saving || selected.status === "withdrawn"} type="button" onClick={() => void moderate("published")}>{saving ? <LoaderCircle className="admin-spinner" /> : <CheckCircle2 />} Publish review</button>
              </div>
            </section>
          ) : (
            <section className="admin-review-detail admin-empty-panel"><MessageSquareText /><h2>Select a review</h2><p>The verified source and moderation controls will appear here.</p></section>
          )}
        </div>
      </section>
    </main>
  );
}

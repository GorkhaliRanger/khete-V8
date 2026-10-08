"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BadgeCheck, LoaderCircle, MessageSquareText, RotateCcw, Send, Star, Trash2 } from "lucide-react";
import { useMarketplace } from "@/components/marketplace-provider";
import { ReviewStars } from "@/components/review-stars";
import {
  formatReviewDate,
  labelReviewStatus,
  reviewError,
  type ReviewOpportunity,
} from "@/lib/reviews";
import { createClient } from "@/lib/supabase/client";

export function CustomerReviewCentre() {
  const { user, authReady, openLogin } = useMarketplace();
  const [items, setItems] = useState<ReviewOpportunity[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const selectedIdRef = useRef("");

  const selectOpportunity = useCallback((item: ReviewOpportunity, clearFeedback = true) => {
    selectedIdRef.current = item.source_id;
    setSelectedId(item.source_id);
    setRating(item.existing_rating ?? 5);
    setTitle(item.existing_title ?? "");
    setBody(item.existing_body ?? "");
    if (clearFeedback) {
      setError("");
      setMessage("");
    }
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data, error: loadError } = await supabase.rpc("get_my_review_opportunities");
      if (loadError) throw loadError;
      const nextItems = (data ?? []) as ReviewOpportunity[];
      setItems(nextItems);
      const nextSelected = nextItems.find((item) => item.source_id === selectedIdRef.current) ?? nextItems[0];
      if (nextSelected) selectOpportunity(nextSelected, false);
      else {
        selectedIdRef.current = "";
        setSelectedId("");
      }
    } catch (caught) {
      const text = reviewError(caught);
      setError(text.includes("schema cache") || text.includes("function")
        ? "Run the Verified Reviews migration in Supabase to activate this page."
        : text);
    } finally {
      setLoading(false);
    }
  }, [selectOpportunity, user]);

  useEffect(() => {
    if (!authReady || !user) return;
    queueMicrotask(() => void load());
  }, [authReady, load, user]);

  const selected = items.find((item) => item.source_id === selectedId) ?? null;

  const counts = useMemo(() => ({
    eligible: items.filter((item) => !item.existing_status || item.existing_status === "withdrawn").length,
    pending: items.filter((item) => item.existing_status === "pending").length,
    published: items.filter((item) => item.existing_status === "published").length,
  }), [items]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      const { error: submitError } = await supabase.rpc("submit_marketplace_review", {
        p_source_type: selected.source_type,
        p_source_id: selected.source_id,
        p_rating: rating,
        p_title: title.trim() || null,
        p_body: body.trim(),
      });
      if (submitError) throw submitError;
      setMessage("Saved and sent to the moderation queue.");
      await load();
    } catch (caught) {
      setError(reviewError(caught));
    } finally {
      setSaving(false);
    }
  };

  const withdraw = async () => {
    if (!selected?.existing_review_id || !window.confirm("Withdraw this review from khetE?")) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      const { error: withdrawError } = await supabase.rpc("withdraw_marketplace_review", {
        p_review_id: selected.existing_review_id,
      });
      if (withdrawError) throw withdrawError;
      setMessage("The review was withdrawn.");
      await load();
    } catch (caught) {
      setError(reviewError(caught));
    } finally {
      setSaving(false);
    }
  };

  if (!authReady) {
    return <main className="simple-page"><div className="site-container review-state"><LoaderCircle className="admin-spinner" /> Loading your account…</div></main>;
  }

  if (!user) {
    return (
      <main className="simple-page">
        <div className="site-container empty-state">
          <Star />
          <h1>Log in to manage your reviews.</h1>
          <p>Only delivered products and completed professional services can receive verified feedback.</p>
          <button className="primary-button" type="button" onClick={openLogin}>Login or register</button>
        </div>
      </main>
    );
  }

  return (
    <main className="customer-reviews-page">
      <div className="site-container">
        <Link className="back-link" href="/account"><ArrowLeft /> Back to Account</Link>
        <section className="customer-review-hero">
          <div><p className="eyebrow">Customer account</p><h1>Reviews & ratings</h1><p>Share useful feedback on delivered products and completed professional services.</p></div>
          <BadgeCheck />
        </section>

        <section className="customer-review-stats" aria-label="Review summary">
          <article><MessageSquareText /><span><small>Ready to review</small><strong>{counts.eligible}</strong></span></article>
          <article><RotateCcw /><span><small>Pending moderation</small><strong>{counts.pending}</strong></span></article>
          <article><Star /><span><small>Published</small><strong>{counts.published}</strong></span></article>
        </section>

        {error && !selected ? <div className="review-notice error">{error}</div> : null}
        {loading && !items.length ? <div className="review-state"><LoaderCircle className="admin-spinner" /> Loading review opportunities…</div> : null}

        {!loading && !items.length && !error ? (
          <div className="empty-state customer-review-empty">
            <MessageSquareText />
            <h2>Nothing to review yet</h2>
            <p>Delivered order items and completed service requests will appear here automatically.</p>
            <div><Link className="primary-button" href="/products">Browse products</Link><Link className="secondary-button" href="/services">Explore services</Link></div>
          </div>
        ) : null}

        {items.length ? (
          <div className="customer-review-workspace">
            <aside className="customer-review-list">
              {items.map((item) => (
                <button className={selectedId === item.source_id ? "selected" : ""} type="button" key={item.source_id} onClick={() => selectOpportunity(item)}>
                  <span><strong>{item.target_name}</strong><small>{item.secondary_name || (item.target_type === "listing" ? "Product" : "Professional service")}</small><em>{item.reference_number} · {formatReviewDate(item.completed_at)}</em></span>
                  <b className={`review-status review-status-${item.existing_status ?? "eligible"}`}>{item.existing_status ? labelReviewStatus(item.existing_status) : "Ready"}</b>
                </button>
              ))}
            </aside>

            {selected ? (
              <form className="customer-review-editor" onSubmit={submit}>
                <header>
                  <div><p className="eyebrow">{selected.target_type === "listing" ? "Verified purchase" : "Verified service"}</p><h2>{selected.target_name}</h2><p>{selected.secondary_name || selected.reference_number}</p></div>
                  <span className={`review-status review-status-${selected.existing_status ?? "eligible"}`}>{selected.existing_status ? labelReviewStatus(selected.existing_status) : "Ready to review"}</span>
                </header>

                {selected.existing_status === "rejected" && selected.existing_admin_note ? <div className="review-notice warning"><strong>Moderation note</strong>{selected.existing_admin_note}</div> : null}
                {error ? <div className="review-notice error">{error}</div> : null}
                {message ? <div className="review-notice success">{message}</div> : null}

                <label className="customer-rating-label">Your rating <ReviewStars rating={rating} interactive onChange={setRating} /></label>
                <label>Short title <small>Optional</small><input maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What stood out?" /></label>
                <label>Detailed review<textarea minLength={10} maxLength={1200} required value={body} onChange={(event) => setBody(event.target.value)} placeholder="Share accurate details that will help another customer." /></label>
                <div className="customer-review-editor-actions">
                  <span>{body.trim().length}/1200 characters</span>
                  <div>
                    {selected.existing_review_id && selected.existing_status !== "withdrawn" ? <button className="danger-button" disabled={saving} type="button" onClick={() => void withdraw()}><Trash2 /> Withdraw</button> : null}
                    <button className="primary-button" disabled={saving || body.trim().length < 10} type="submit">{saving ? <LoaderCircle className="admin-spinner" /> : <Send />} {selected.existing_review_id ? "Save & resubmit" : "Submit review"}</button>
                  </div>
                </div>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}

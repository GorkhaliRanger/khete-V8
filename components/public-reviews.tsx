"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, LoaderCircle, MessageSquareText, Send } from "lucide-react";
import { ReviewStars } from "@/components/review-stars";
import { useMarketplace } from "@/components/marketplace-provider";
import {
  formatReviewDate,
  reviewError,
  type MarketplaceReview,
  type ReviewOpportunity,
} from "@/lib/reviews";
import { createClient } from "@/lib/supabase/client";

type PublicReview = Pick<
  MarketplaceReview,
  "id" | "reviewer_name" | "rating" | "title" | "body" | "published_at" | "created_at"
>;

export function PublicReviews({
  targetType,
  targetId,
}: {
  targetType: "listing" | "professional";
  targetId: string;
}) {
  const { user, authReady, openLogin } = useMarketplace();
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [opportunities, setOpportunities] = useState<ReviewOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const targetColumn = targetType === "listing" ? "listing_id" : "profile_id";
      const { data: reviewData, error: reviewLoadError } = await supabase
        .from("marketplace_reviews")
        .select("id,reviewer_name,rating,title,body,published_at,created_at")
        .eq("status", "published")
        .eq(targetColumn, targetId)
        .order("published_at", { ascending: false });
      if (reviewLoadError) throw reviewLoadError;
      setReviews((reviewData ?? []) as PublicReview[]);

      if (user) {
        const { data: opportunityData, error: opportunityError } = await supabase.rpc(
          "get_my_review_opportunities",
        );
        if (opportunityError) throw opportunityError;
        const matching = ((opportunityData ?? []) as ReviewOpportunity[])
          .filter((item) => item.target_type === targetType && item.target_id === targetId);
        setOpportunities(matching);
        const writable = matching.find((item) => !item.existing_status || ["rejected", "withdrawn"].includes(item.existing_status));
        setSelectedSourceId((current) => current || writable?.source_id || "");
      } else {
        setOpportunities([]);
        setSelectedSourceId("");
      }
    } catch (caught) {
      const text = reviewError(caught);
      setError(text.includes("schema cache") || text.includes("relation")
        ? "Run the Verified Reviews migration in Supabase to activate ratings."
        : text);
    } finally {
      setLoading(false);
    }
  }, [targetId, targetType, user]);

  useEffect(() => {
    if (!authReady) return;
    queueMicrotask(() => void load());
  }, [authReady, load]);

  const summary = useMemo(() => {
    if (!reviews.length) return { average: 0, count: 0 };
    return {
      average: reviews.reduce((total, review) => total + Number(review.rating), 0) / reviews.length,
      count: reviews.length,
    };
  }, [reviews]);

  const writableOpportunities = opportunities.filter(
    (item) => !item.existing_status || ["rejected", "withdrawn"].includes(item.existing_status),
  );
  const selectedOpportunity = writableOpportunities.find((item) => item.source_id === selectedSourceId);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedOpportunity) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      const { error: submitError } = await supabase.rpc("submit_marketplace_review", {
        p_source_type: selectedOpportunity.source_type,
        p_source_id: selectedOpportunity.source_id,
        p_rating: rating,
        p_title: title.trim() || null,
        p_body: body.trim(),
      });
      if (submitError) throw submitError;
      setMessage("Your verified review was submitted for moderation.");
      setTitle("");
      setBody("");
      setRating(5);
      setSelectedSourceId("");
      await load();
    } catch (caught) {
      setError(reviewError(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="public-reviews" id="reviews" aria-labelledby="public-review-heading">
      <div className="public-review-heading">
        <div>
          <p className="eyebrow">Verified feedback</p>
          <h2 id="public-review-heading">Customer reviews</h2>
          <p>Only delivered purchases and completed professional services can be reviewed.</p>
        </div>
        <div className="review-summary">
          <strong>{summary.count ? summary.average.toFixed(1) : "—"}</strong>
          <span><ReviewStars rating={summary.average} /> {summary.count} published review{summary.count === 1 ? "" : "s"}</span>
        </div>
      </div>

      {loading ? <div className="review-state"><LoaderCircle className="admin-spinner" /> Loading reviews…</div> : null}
      {error ? <div className="review-notice error">{error}</div> : null}
      {message ? <div className="review-notice success">{message}</div> : null}

      {!loading && reviews.length ? (
        <div className="public-review-grid">
          {reviews.slice(0, 6).map((review) => (
            <article className="public-review-card" key={review.id}>
              <header>
                <ReviewStars rating={Number(review.rating)} />
                <span><BadgeCheck /> Verified</span>
              </header>
              {review.title ? <h3>{review.title}</h3> : null}
              <p>{review.body}</p>
              <footer><strong>{review.reviewer_name}</strong><span>{formatReviewDate(review.published_at ?? review.created_at)}</span></footer>
            </article>
          ))}
        </div>
      ) : !loading && !error ? (
        <div className="review-state"><MessageSquareText /><span><strong>No published reviews yet.</strong> Be the first verified customer to share useful feedback.</span></div>
      ) : null}

      {!authReady ? null : !user ? (
        <div className="review-contribute">
          <div><h3>Purchased or completed this?</h3><p>Log in to submit a verified review linked to your order or service request.</p></div>
          <button className="secondary-button" type="button" onClick={openLogin}>Login to review</button>
        </div>
      ) : writableOpportunities.length ? (
        <form className="review-form" onSubmit={submit}>
          <div className="review-form-heading"><div><p className="eyebrow">Your experience</p><h3>Write a verified review</h3></div><ReviewStars rating={rating} interactive onChange={setRating} /></div>
          {writableOpportunities.length > 1 ? (
            <label>Choose purchase or service
              <select value={selectedSourceId} onChange={(event) => setSelectedSourceId(event.target.value)} required>
                <option value="">Choose one</option>
                {writableOpportunities.map((item) => <option value={item.source_id} key={item.source_id}>{item.reference_number}{item.secondary_name ? ` · ${item.secondary_name}` : ""}</option>)}
              </select>
            </label>
          ) : null}
          <div className="review-form-grid">
            <label>Short title <small>Optional</small><input maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What stood out?" /></label>
            <label className="span-two">Review<textarea minLength={10} maxLength={1200} required value={body} onChange={(event) => setBody(event.target.value)} placeholder="Share accurate, useful details about quality, service, delivery or results." /></label>
          </div>
          <div className="review-form-actions"><span>{body.trim().length}/1200 characters</span><button className="primary-button" disabled={saving || !selectedSourceId || body.trim().length < 10} type="submit">{saving ? <LoaderCircle className="admin-spinner" /> : <Send />} Submit for moderation</button></div>
        </form>
      ) : opportunities.length ? (
        <div className="review-contribute">
          <div><h3>Your review is already recorded.</h3><p>Track its moderation status or edit it from your Account review centre.</p></div>
          <Link className="secondary-button" href="/account/reviews">Manage reviews</Link>
        </div>
      ) : (
        <div className="review-contribute muted">
          <div><h3>Verified reviews only</h3><p>This review form becomes available after your order is delivered or your professional service is completed.</p></div>
        </div>
      )}
    </section>
  );
}

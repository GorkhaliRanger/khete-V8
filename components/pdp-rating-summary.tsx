"use client";

import { useEffect, useState } from "react";
import { ReviewStars } from "@/components/review-stars";
import { createClient } from "@/lib/supabase/client";

type RatingRow = { rating: number };

export function PdpRatingSummary({ listingId }: { listingId: string }) {
  const [average, setAverage] = useState<number | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("marketplace_reviews")
          .select("rating")
          .eq("status", "published")
          .eq("listing_id", listingId);
        if (error) throw error;
        if (cancelled) return;
        const rows = (data ?? []) as RatingRow[];
        setCount(rows.length);
        setAverage(rows.length ? rows.reduce((total, row) => total + row.rating, 0) / rows.length : null);
      } catch {
        if (!cancelled) { setCount(0); setAverage(null); }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [listingId]);

  return (
    <div className="pdp-rating-summary">
      {average !== null ? (
        <>
          <ReviewStars rating={Math.round(average)} />
          <strong>{average.toFixed(1)}</strong>
          <span>{count} rating{count === 1 ? "" : "s"}</span>
        </>
      ) : (
        <span className="pdp-no-ratings">No ratings yet — be the first to review after purchase</span>
      )}
    </div>
  );
}

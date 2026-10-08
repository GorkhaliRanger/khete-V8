import { Star } from "lucide-react";

export function ReviewStars({
  rating,
  label,
  interactive = false,
  onChange,
}: {
  rating: number;
  label?: string;
  interactive?: boolean;
  onChange?: (rating: number) => void;
}) {
  const safeRating = Math.max(0, Math.min(5, rating));

  return (
    <span className={`review-stars ${interactive ? "is-interactive" : ""}`} aria-label={label ?? `${safeRating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => {
        const star = <Star size={interactive ? 24 : 17} fill={value <= safeRating ? "currentColor" : "none"} />;
        return interactive
          ? (
            <button
              aria-label={`Rate ${value} out of 5`}
              className={value <= safeRating ? "selected" : ""}
              key={value}
              onClick={() => onChange?.(value)}
              type="button"
            >
              {star}
            </button>
          )
          : <span className={value <= safeRating ? "selected" : ""} key={value}>{star}</span>;
      })}
    </span>
  );
}

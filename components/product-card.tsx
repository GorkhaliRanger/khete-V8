"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { formatNpr, type Listing } from "@/data/marketplace";
import { useMarketplace } from "./marketplace-provider";
import { ProductVisual } from "./product-visual";
import { BrandName } from "./brand-name";

export function ProductCard({ listing, spotlight, serviceCta }: { listing: Listing; spotlight?: boolean; serviceCta?: boolean }) {
  const { wishlist, toggleWishlist } = useMarketplace();
  const saved = wishlist.has(listing.id);
  const hasVariants = Boolean(listing.variants?.length);
  const detailsHref = `/products/${listing.slug}`;
  const ctaLabel = listing.type === "rental"
    ? "Rent now"
    : /quote/i.test(listing.priceLabel ?? "")
      ? "Request quote"
      : listing.type === "service"
        ? "Book service"
        : null;
  const showServiceCta = serviceCta ?? (listing.type === "service" || listing.type === "rental");
  const rememberReturnLocation = () => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem("khete-product-return", `${window.location.pathname}${window.location.search}`);
  };

  return (
    <article className={`product-card ${spotlight ? "product-card-spotlight" : ""}`}>
      {spotlight ? <span className="spotlight-ribbon">Homepage pick</span> : null}
      <div className="product-card-media">
        <Link href={detailsHref} onClick={rememberReturnLocation} aria-label={`View ${listing.name}`}>
          <ProductVisual listing={listing} />
        </Link>
        {listing.newArrival || listing.deal ? (
          <div className="product-card-badges">
            {listing.newArrival ? <span className="new-arrival-pill">New Arrival</span> : null}
            {listing.deal ? <span className="deal-pill">{listing.offerTitle || <><BrandName /> Offer</>}</span> : null}
          </div>
        ) : null}
        <button
          className={`save-button ${saved ? "is-saved" : ""}`}
          type="button"
          onClick={() => void toggleWishlist(listing.id)}
          aria-label={saved ? `Remove ${listing.name} from wishlist` : `Add ${listing.name} to wishlist`}
        >
          <Heart size={19} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="product-card-body">
        <p className="eyebrow">{listing.childCategory} · {listing.type}</p>
        <Link className="product-name" href={detailsHref} onClick={rememberReturnLocation}>{listing.name}</Link>
        <div className="price-row">
          <div>
            <strong>{hasVariants ? "From " : ""}{listing.price ? formatNpr(listing.price) : listing.priceLabel}</strong>
            {listing.compareAt ? <del>{formatNpr(listing.compareAt)}</del> : null}
            {listing.unit ? <span className="unit-label"> / {listing.unit}</span> : null}
          </div>
          <span className={`stock-dot ${listing.available ? "available" : ""}`}>{listing.available ? "Available" : "Unavailable"}</span>
        </div>
        {showServiceCta && ctaLabel ? (
          <Link className="product-card-cta" href={detailsHref} onClick={rememberReturnLocation}>
            {ctaLabel}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

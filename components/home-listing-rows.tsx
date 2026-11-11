"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Milk, Pause, Play, Sprout, Tractor, Wheat, Wrench } from "lucide-react";
import { formatNpr, type Listing } from "@/data/marketplace";
import { createClient } from "@/lib/supabase/client";
import { selectMoreMobileProducts } from "@/lib/home-mobile-products";
import { useMarketplace } from "./marketplace-provider";
import { ProductCard } from "./product-card";
import { BrandName } from "./brand-name";

type HighlightSection = "deals" | "featured" | "popular";

export type HighlightPromo = {
  badge: string;
  headline: string;
  description: string;
  imageUrl: string;
};

type HighlightPick = { listingId: string; promo: HighlightPromo };

const toneIcons = {
  machinery: Tractor,
  produce: Sprout,
  "seeds-inputs": Wheat,
  livestock: Milk,
  services: Wrench,
} as const;

function listingImage(listing: Listing) {
  return (listing.images?.find((image) => image.primary) ?? listing.images?.[0])?.url ?? "";
}

function listingPrice(listing: Listing) {
  if (listing.price != null) return formatNpr(listing.price);
  if (listing.priceLabel) return listing.priceLabel;
  return "See options";
}

function discountPercent(listing: Listing) {
  if (listing.compareAt == null || listing.price == null || listing.compareAt <= listing.price) return 0;
  return Math.round((1 - listing.price / listing.compareAt) * 100);
}

// Deep link into the category page: the clicked product is pinned first,
// followed by everything else in its category.
function categoryHref(listing: Listing) {
  return `/shop/${listing.categoryId}?pin=${encodeURIComponent(listing.slug)}`;
}

function dayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD — the rotation changes every day
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

// Daily popularity score. Demand signal (availability, featured/deal traction and variant
// uptake as a proxy for sales velocity) is blended with a date-seeded rotation so the
// lineup refreshes every day. Swap the signal for real view/sales counts once analytics
// are tracked in the database.
function dailyPopularityScore(listing: Listing, key: string) {
  const signal =
    (listing.available ? 2 : 0) +
    (listing.featured ? 2 : 0) +
    (listing.deal ? 1 : 0) +
    Math.min(listing.variants?.length ?? 0, 3);
  const rotation = hashString(`${listing.id}|${key}`) % 1000;
  return signal * 1000 + rotation;
}

function useHomePicks() {
  const [picks, setPicks] = useState<Record<HighlightSection, HighlightPick[]>>({ deals: [], featured: [], popular: [] });
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("home_highlights")
        .select("section, listing_id, position, badge, headline, description, image_path")
        .order("position", { ascending: true });
      if (!mounted || error) return; // table not applied yet — sections fall back gracefully
      const publicUrl = (path: string) => supabase.storage.from("marketplace-media").getPublicUrl(path).data.publicUrl;
      const next: Record<HighlightSection, HighlightPick[]> = { deals: [], featured: [], popular: [] };
      (data ?? []).forEach((row) => {
        const section = row.section as HighlightSection;
        if (next[section] && typeof row.listing_id === "string") {
          next[section].push({
            listingId: row.listing_id,
            promo: {
              badge: typeof row.badge === "string" ? row.badge : "",
              headline: typeof row.headline === "string" ? row.headline : "",
              description: typeof row.description === "string" ? row.description : "",
              imageUrl: typeof row.image_path === "string" && row.image_path ? publicUrl(row.image_path) : "",
            },
          });
        }
      });
      setPicks(next);
    };
    void load();
    return () => { mounted = false; };
  }, []);
  return picks;
}

const emptyPromo: HighlightPromo = { badge: "", headline: "", description: "", imageUrl: "" };

function SectionHeading({ eyebrow, title, note, href, linkLabel }: { eyebrow: string; title: React.ReactNode; note?: string; href: string; linkLabel: string }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {note ? <p>{note}</p> : null}
      </div>
      <Link className="text-button" href={href}>
        {linkLabel} <ArrowRight size={17} />
      </Link>
    </div>
  );
}

/* Deals of the day — eBay-style banner carousel: full-width slides with an image
   backdrop, badge, headline, price and CTA on the left; dots and prev/next/pause
   controls. Auto-advances every 6 seconds unless paused. */
function DealCarousel({ items }: { items: { listing: Listing; promo: HighlightPromo }[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = items.length;

  useEffect(() => {
    if (paused || count < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), 6000);
    return () => window.clearInterval(timer);
  }, [paused, count]);

  const goTo = (next: number) => setIndex(((next % count) + count) % count);

  return (
    <div className="deal-carousel" aria-roledescription="carousel" aria-label="Deals of the day">
      <div className="deal-carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {items.map(({ listing, promo }) => {
          const href = categoryHref(listing);
          const image = promo.imageUrl || listingImage(listing);
          const percent = discountPercent(listing);
          const badge = promo.badge || listing.offerTitle || (percent ? `${percent}% OFF` : "Deal of the day");
          return (
            <article className="deal-slide" key={listing.id}>
              {image ? <img className="deal-slide-bg" src={image} alt="" loading="lazy" /> : <span className={`deal-slide-bg deal-card-fallback tone-${listing.tone}`} aria-hidden="true" />}
              <span className="deal-slide-shade" aria-hidden="true" />
              <div className="deal-slide-content">
                <span className="deal-slide-badge">{badge}</span>
                <h3>{promo.headline || listing.name}</h3>
                <p>{promo.description || `${listing.childCategory} · ${listing.type}`}</p>
                <div className="deal-slide-price">
                  <strong>{listingPrice(listing)}</strong>
                  {listing.compareAt != null ? <del>{formatNpr(listing.compareAt)}</del> : null}
                  {percent ? <span className="deal-off-pill">{percent}% OFF</span> : null}
                </div>
                <Link className="deal-slide-cta" href={href}>
                  Grab this deal <ArrowRight size={16} />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      {count > 1 ? (
        <>
          <div className="deal-carousel-dots" aria-label="Choose deal slide">
            {items.map(({ listing }, dotIndex) => (
              <button
                key={listing.id}
                type="button"
                className={dotIndex === index ? "active" : ""}
                aria-label={`Go to deal ${dotIndex + 1}: ${listing.name}`}
                aria-pressed={dotIndex === index}
                onClick={() => goTo(dotIndex)}
              />
            ))}
          </div>
          <div className="deal-carousel-controls">
            <button type="button" aria-label="Previous deal" onClick={() => goTo(index - 1)}><ChevronLeft size={18} /></button>
            <button type="button" aria-label="Next deal" onClick={() => goTo(index + 1)}><ChevronRight size={18} /></button>
            <button type="button" aria-label={paused ? "Play deals slideshow" : "Pause deals slideshow"} onClick={() => setPaused((value) => !value)}>
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* Featured products — FlyonUI-style mosaic: two large split tiles on top
   (content left, image right) and two full-bleed image tiles below. */
function FeaturedShowcase({ items }: { items: { listing: Listing; promo: HighlightPromo }[] }) {
  return (
    <div className="featured-showcase">
      {items.slice(0, 4).map(({ listing, promo }, index) => {
        const href = categoryHref(listing);
        const image = promo.imageUrl || listingImage(listing) || `/promos/featured-${index + 1}.png`;
        const Icon = toneIcons[listing.categoryId as keyof typeof toneIcons] ?? Sprout;
        const percent = discountPercent(listing);
        const badge = promo.badge || (percent ? `Save ${percent}% today` : "Featured pick");
        const headline = promo.headline || listing.name;
        const line = promo.description || `${listing.childCategory} · ${listing.type}`;
        const media = image ? <img src={image} alt={headline} loading="lazy" /> : (
          <span className={`featured-tile-fallback tone-${listing.tone}`} aria-hidden="true">
            <Icon strokeWidth={1.35} />
          </span>
        );
        if (index < 2) {
          return (
            <article className="featured-tile featured-tile-split" key={listing.id}>
              <div className="featured-tile-content">
                <span className="featured-tile-badge">{badge}</span>
                <h3>{headline}</h3>
                <p className="featured-tile-line">{line}</p>
                <footer>
                  <Link className="featured-tile-button" href={href}>
                    Explore now <ArrowRight size={16} />
                  </Link>
                  <span className="featured-tile-price"><small>Starting at</small>{listingPrice(listing)}</span>
                </footer>
              </div>
              <Link className="featured-tile-media" href={href} aria-label={`View ${listing.name}`} tabIndex={-1}>
                {media}
              </Link>
            </article>
          );
        }
        return (
          <article className="featured-tile featured-tile-cover" key={listing.id}>
            <Link className="featured-tile-media" href={href} aria-label={`View ${listing.name}`} tabIndex={-1}>
              {media}
            </Link>
            <span className="featured-tile-shade" aria-hidden="true" />
            <div className="featured-tile-content">
              <span className="featured-tile-badge">{badge}</span>
              <h3>{headline}</h3>
              <p className="featured-tile-line">{line}</p>
              <footer>
                <Link className="featured-tile-button" href={href}>
                  Explore now <ArrowRight size={16} />
                </Link>
                <span className="featured-tile-price"><small>Starting at</small>{listingPrice(listing)}</span>
              </footer>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function useHomeSectionData() {
  const { listings } = useMarketplace();
  const picks = useHomePicks();
  const key = dayKey();

  const resolve = (section: HighlightSection, fallbackPool: Listing[], limit = 4): { listing: Listing; promo: HighlightPromo }[] => {
    const chosen = picks[section]
      .map((pick) => {
        const listing = listings.find((item) => item.id === pick.listingId);
        return listing ? { listing, promo: pick.promo } : null;
      })
      .filter((entry): entry is { listing: Listing; promo: HighlightPromo } => Boolean(entry))
      .slice(0, limit);
    if (chosen.length) return chosen;
    return fallbackPool
      .filter((listing) => listing.available !== false)
      .slice(0, limit)
      .map((listing) => ({ listing, promo: emptyPromo }));
  };

  // Fallback pools when the admin has not picked anything for a section yet.
  const dealPool = listings.filter((listing) => listing.deal || listing.compareAt);
  const featuredPool = listings.filter((listing) => listing.featured);
  const popularPool = [...listings].sort(
    (a, b) => dailyPopularityScore(b, key) - dailyPopularityScore(a, key)
  );
  const arrivalPool = listings
    .filter((listing) => listing.newArrival)
    .sort((a, b) => new Date(b.newArrivalAt ?? 0).getTime() - new Date(a.newArrivalAt ?? 0).getTime());

  return {
    deals: resolve("deals", dealPool.length ? dealPool : popularPool, 5),
    featured: resolve("featured", featuredPool.length ? featuredPool : listings),
    popular: resolve("popular", popularPool),
    arrivals: (arrivalPool.length ? arrivalPool : [...listings].reverse()).slice(0, 4),
  };
}

/* khetE's Deals renders on its own so the homepage can place Shop Products right below it. */
export function HomeDealsSection() {
  const { deals } = useHomeSectionData();
  if (!deals.length) return null;
  return (
    <section className="home-section">
      <div className="site-container">
        <SectionHeading
          eyebrow="Deals of the Day"
          title={<><BrandName />&rsquo;s Deals &amp; Bargains</>}
          href="/deals"
          linkLabel="View all deals"
        />
        <DealCarousel items={deals} />
      </div>
    </section>
  );
}

const MOBILE_PRODUCT_BATCH = 10;
const DESKTOP_ROW_BATCH = 4;

function MobileMoreProducts() {
  const { listings, listingsReady } = useMarketplace();
  const [isMobile, setIsMobile] = useState(true);
  const [mobileVisibleCount, setMobileVisibleCount] = useState(MOBILE_PRODUCT_BATCH);
  const [desktopRows, setDesktopRows] = useState(DESKTOP_ROW_BATCH);
  const [desktopColumns, setDesktopColumns] = useState(4);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const products = useMemo(() => selectMoreMobileProducts(listings), [listings]);
  const visibleCount = isMobile ? mobileVisibleCount : desktopRows * desktopColumns;
  const visibleProducts = products.slice(0, visibleCount);
  const hasMore = visibleCount < products.length;

  useEffect(() => {
    const breakpoint = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(breakpoint.matches);
    const frame = window.requestAnimationFrame(update);
    breakpoint.addEventListener("change", update);
    return () => {
      window.cancelAnimationFrame(frame);
      breakpoint.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    const grid = gridRef.current;
    if (!listingsReady || !grid) return;
    const measure = () => {
      // The resolved CSS grid tracks reflect the actual viewport and container.
      const tracks = window.getComputedStyle(grid).gridTemplateColumns.trim();
      if (!tracks || tracks === "none") return;
      setDesktopColumns(Math.max(1, tracks.split(/\s+/).length));
    };
    const frame = window.requestAnimationFrame(measure);
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    resizeObserver?.observe(grid);
    window.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [listingsReady, products.length]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!isMobile || !listingsReady || !hasMore || !target) return;

    // Older browsers still show the whole catalog without a manual action.
    if (typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setMobileVisibleCount(products.length), 0);
      return () => window.clearTimeout(timer);
    }

    let advanced = false;
    const revealNext = () => {
      if (advanced) return;
      advanced = true;
      setMobileVisibleCount((count) => Math.min(count + MOBILE_PRODUCT_BATCH, products.length));
    };
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) revealNext();
    }, { rootMargin: "360px 0px" });
    observer.observe(target);
    // Scroll/resize also advances the feed if an observer misses a fast scroll.
    const checkPosition = () => {
      if (target.getBoundingClientRect().top <= window.innerHeight + 360) revealNext();
    };
    window.addEventListener("scroll", checkPosition, { passive: true });
    window.addEventListener("resize", checkPosition);
    const frame = window.requestAnimationFrame(checkPosition);
    return () => {
      advanced = true;
      observer.disconnect();
      window.removeEventListener("scroll", checkPosition);
      window.removeEventListener("resize", checkPosition);
      window.cancelAnimationFrame(frame);
    };
  }, [hasMore, isMobile, listingsReady, mobileVisibleCount, products.length]);

  if (!listingsReady || !products.length) return null;

  return (
    <section className="home-section home-mobile-products" aria-labelledby="home-mobile-products-title">
      <div className="site-container">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Keep exploring</p>
            <h2 id="home-mobile-products-title">All marketplace listings</h2>
          </div>
        </div>
        <div className="product-grid product-grid-compact" ref={gridRef}>
          {visibleProducts.map((listing) => <ProductCard key={listing.id} listing={listing} />)}
        </div>
        <p className="home-mobile-products-count" aria-live="polite">
          Showing {visibleProducts.length} of {products.length} listings
        </p>
        {hasMore && isMobile ? (
          <div className="home-mobile-products-more" ref={loadMoreRef} role="status">Loading more listings…</div>
        ) : null}
        {hasMore && !isMobile ? (
          <div className="home-desktop-products-more">
            <button className="secondary-button" type="button" onClick={() => setDesktopRows((rows) => rows + DESKTOP_ROW_BATCH)}>
              Load more listings
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function HomeListingSections() {
  const { featured, popular, arrivals } = useHomeSectionData();

  return (
    <>
      {featured.length ? (
        <section className="home-section">
          <div className="site-container">
            <SectionHeading
              eyebrow="Featured"
              title="Featured Products"
              href="/products"
              linkLabel="View more"
            />
            <FeaturedShowcase items={featured} />
          </div>
        </section>
      ) : null}

      {popular.length ? (
        <section className="home-section">
          <div className="site-container">
            <SectionHeading
              eyebrow="Trending today"
              title={<><BrandName />&rsquo;s Most Popular</>}
              note="Refreshed daily."
              href="/products"
              linkLabel="View more"
            />
            <div className="product-grid product-grid-compact">
              {popular.map(({ listing }) => (
                <ProductCard key={listing.id} listing={listing} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {arrivals.length ? (
        <section className="home-section">
          <div className="site-container">
            <SectionHeading
              eyebrow="New Arrivals"
              title="Recently added products and varieties."
              href="/products"
              linkLabel="View more"
            />
            <div className="product-grid product-grid-compact">
              {arrivals.map((listing) => (
                <ProductCard key={listing.id} listing={listing} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <MobileMoreProducts />
    </>
  );
}

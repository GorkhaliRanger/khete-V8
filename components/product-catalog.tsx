"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { formatNpr, type Listing, type ListingType } from "@/data/marketplace";
import { ProductCard } from "./product-card";
import { BrandName } from "./brand-name";
import { useMarketplace } from "./marketplace-provider";

const listingTypes: { value: ListingType; label: string }[] = [
  { value: "product", label: "Products" },
  { value: "produce", label: "Fresh produce" },
  { value: "service", label: "Services" },
  { value: "rental", label: "Rentals" },
  { value: "livestock", label: "Livestock" },
];

const numericPrice = (listing: Listing) => {
  if (listing.price) return listing.price;
  const match = listing.priceLabel?.match(/[\d,]+/);
  return match ? Number(match[0].replaceAll(",", "")) : null;
};

export function ProductCatalog({ dealsOnly = false, servicesOnly = false }: { dealsOnly?: boolean; servicesOnly?: boolean }) {
  const { categories, listings } = useMarketplace();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const category = searchParams.get("category") ?? "all";
  const child = searchParams.get("child");
  const grandchild = searchParams.get("grandchild");
  const availableTypeOptions = servicesOnly ? listingTypes.filter((item) => item.value === "service" || item.value === "rental") : listingTypes;
  const [activeTypes, setActiveTypes] = useState<Set<ListingType>>(new Set(availableTypeOptions.map((item) => item.value)));
  const [availableOnly, setAvailableOnly] = useState(false);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const sentinel = useRef<HTMLDivElement>(null);

  const sourceListings = useMemo(() => listings.filter((listing) =>
    (!dealsOnly || listing.deal) && (!servicesOnly || listing.type === "service" || listing.type === "rental"),
  ), [dealsOnly, servicesOnly, listings]);
  const relevantCategories = useMemo(() => categories.filter((item) => sourceListings.some((listing) => listing.categoryId === item.id)), [sourceListings, categories]);
  const priceBounds = useMemo(() => {
    const prices = sourceListings.map(numericPrice).filter((price): price is number => price !== null);
    return prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : { min: 0, max: 1000000 };
  }, [sourceListings]);
  const [minimumPriceOverride, setMinimumPrice] = useState<number | null>(null);
  const [maximumPriceOverride, setMaximumPrice] = useState<number | null>(null);
  const minimumPrice = minimumPriceOverride ?? priceBounds.min;
  const maximumPrice = maximumPriceOverride ?? priceBounds.max;

  const selectedChildName = useMemo(() => {
    if (!child) return null;
    return categories.flatMap((item) => item.children).find((item) => item.id === child)?.name ?? null;
  }, [child, categories]);
  const selectedGrandchildName = useMemo(() => {
    if (!grandchild) return null;
    return categories.flatMap((item) => item.children).flatMap((item) => item.grandchildren).find((item) => item.id === grandchild)?.name ?? null;
  }, [grandchild, categories]);

  const filtered = useMemo(() => sourceListings.filter((listing) => {
    const price = numericPrice(listing);
    return (
    (category === "all" || listing.categoryId === category) &&
    (!selectedChildName || listing.childCategory === selectedChildName) &&
    (!selectedGrandchildName || listing.grandchildCategory === selectedGrandchildName) &&
    activeTypes.has(listing.type) &&
    (!availableOnly || listing.available) &&
    (price === null || (price >= minimumPrice && price <= maximumPrice))
    );
  }), [sourceListings, category, selectedChildName, selectedGrandchildName, activeTypes, availableOnly, minimumPrice, maximumPrice]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setVisibleCount((count) => Math.min(count + 4, filtered.length));
    }, { rootMargin: "180px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [filtered.length]);

  const toggleType = (type: ListingType) => {
    setVisibleCount(6);
    setActiveTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const selectCategory = (nextCategory: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("child");
    params.delete("grandchild");
    if (nextCategory === "all") params.delete("category");
    else params.set("category", nextCategory);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    setVisibleCount(6);
  };

  const resetFilters = () => {
    selectCategory("all");
    setActiveTypes(new Set(availableTypeOptions.map((item) => item.value)));
    setAvailableOnly(false);
    setMinimumPrice(null);
    setMaximumPrice(null);
  };

  const filters = (
    <aside className={`catalog-filters ${mobileFilters ? "is-open" : ""}`}>
      <div className="filter-heading"><strong>Filter Your Search</strong><button type="button" onClick={() => setMobileFilters(false)} aria-label="Close filters"><X /></button></div>
      <fieldset>
        <legend>Category</legend>
        <label className="radio-row"><input type="radio" name={`${dealsOnly ? "deal" : "catalog"}-category`} checked={category === "all"} onChange={() => selectCategory("all")} /><span>All categories</span></label>
        {relevantCategories.map((item) => <label className="radio-row" key={item.id}><input type="radio" name={`${dealsOnly ? "deal" : "catalog"}-category`} checked={category === item.id} onChange={() => selectCategory(item.id)} /><span>{item.name}</span></label>)}
      </fieldset>
      <fieldset>
        <legend>Listing type</legend>
        {availableTypeOptions.map((item) => <label className="check-row" key={item.value}><input type="checkbox" checked={activeTypes.has(item.value)} onChange={() => toggleType(item.value)} /><span>{item.label}</span></label>)}
      </fieldset>
      <fieldset><legend>Availability</legend><label className="check-row"><input type="checkbox" checked={availableOnly} onChange={(event) => { setAvailableOnly(event.target.checked); setVisibleCount(6); }} /><span>Available now</span></label></fieldset>
      <fieldset className="price-filter">
        <legend>Price range</legend>
        <div className="price-inputs">
          <label>Lowest<input type="number" min={priceBounds.min} max={maximumPrice} value={minimumPrice} onChange={(event) => setMinimumPrice(Math.min(Number(event.target.value), maximumPrice))} /></label>
          <label>Highest<input type="number" min={minimumPrice} max={priceBounds.max} value={maximumPrice} onChange={(event) => setMaximumPrice(Math.max(Number(event.target.value), minimumPrice))} /></label>
        </div>
        <label className="range-control"><span>Minimum price</span><input type="range" min={priceBounds.min} max={priceBounds.max} value={minimumPrice} onChange={(event) => setMinimumPrice(Math.min(Number(event.target.value), maximumPrice))} /></label>
        <label className="range-control"><span>Maximum price</span><input type="range" min={priceBounds.min} max={priceBounds.max} value={maximumPrice} onChange={(event) => setMaximumPrice(Math.max(Number(event.target.value), minimumPrice))} /></label>
        <p>{formatNpr(minimumPrice)} — {formatNpr(maximumPrice)}</p>
        <small>Listings priced by quotation remain visible.</small>
      </fieldset>
      <fieldset><legend>More filters</legend><button className="quiet-filter" type="button">Delivery district</button></fieldset>
    </aside>
  );

  return (
    <section className={`catalog-section ${dealsOnly ? "deals-catalog-section" : servicesOnly ? "services-catalog-section" : "products-catalog-section"}`}>
      <div className="site-container">
        <button className="mobile-filter-toggle" type="button" onClick={() => setMobileFilters(true)}><SlidersHorizontal size={18} /> Filters</button>
        <div className="catalog-layout">
          {filters}
          <div className="catalog-content">
            <div className="catalog-heading">
              <div><p className="eyebrow">{dealsOnly ? "Current promotions" : servicesOnly ? "Available support" : "Available listings"}</p><h2>{selectedGrandchildName ?? selectedChildName ?? (category === "all" ? (dealsOnly ? <>All <BrandName /> Deals</> : servicesOnly ? "All services and rentals" : "All products and services") : categories.find((item) => item.id === category)?.name)}</h2></div>
              <span>{filtered.length} listings</span>
            </div>
            <div className="catalog-results-scroll">
              <div className="product-grid">{filtered.slice(0, visibleCount).map((listing) => <ProductCard key={listing.id} listing={listing} serviceCta={servicesOnly} />)}</div>
              {!filtered.length ? <div className="empty-state"><h3>No listings match these filters</h3><button className="secondary-button" type="button" onClick={resetFilters}>Reset filters</button></div> : null}
              <div ref={sentinel} className="load-sentinel" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

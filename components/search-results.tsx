"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { type ListingType } from "@/data/marketplace";
import { ProductCard } from "./product-card";
import { useMarketplace } from "./marketplace-provider";

const types: { value: ListingType; label: string }[] = [
  { value: "product", label: "Products" },
  { value: "produce", label: "Fresh produce" },
  { value: "service", label: "Services" },
  { value: "rental", label: "Rentals" },
  { value: "livestock", label: "Livestock" },
];

export function SearchResults() {
  const { searchQuery, setSearchQuery, categories, listings } = useMarketplace();
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const [activeTypes, setActiveTypes] = useState<Set<ListingType>>(new Set(types.map((item) => item.value)));
  const [category, setCategory] = useState("all");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [mobileFilters, setMobileFilters] = useState(false);

  const results = useMemo(() => {
    const tokens = deferredQuery.split(/\s+/).filter(Boolean);
    return listings
      .map((listing) => {
        const categoryData = categories.find((item) => item.id === listing.categoryId);
        const haystack = [
          listing.name,
          listing.nameNe,
          listing.description,
          listing.childCategory,
          listing.grandchildCategory,
          categoryData?.name,
          categoryData?.nameNe,
          ...listing.specifications,
          ...listing.tags,
        ].join(" ").toLowerCase();
        const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
        const exactBoost = haystack.includes(deferredQuery) ? 3 : 0;
        return { listing, score: score + exactBoost };
      })
      .filter(({ listing, score }) =>
        score > 0 &&
        activeTypes.has(listing.type) &&
        (category === "all" || listing.categoryId === category) &&
        (!availableOnly || listing.available),
      )
      .sort((a, b) => b.score - a.score);
  }, [deferredQuery, activeTypes, category, availableOnly, categories, listings]);

  const toggleType = (type: ListingType) => {
    setActiveTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const filterPanel = (
    <aside className={`catalog-filters ${mobileFilters ? "is-open" : ""}`}>
      <div className="filter-heading"><strong>Filter matches</strong><button type="button" onClick={() => setMobileFilters(false)} aria-label="Close filters"><X /></button></div>
      <fieldset>
        <legend>Listing type</legend>
        {types.map((type) => (
          <label className="check-row" key={type.value}>
            <input type="checkbox" checked={activeTypes.has(type.value)} onChange={() => toggleType(type.value)} />
            <span>{type.label}</span>
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Category</legend>
        <label className="radio-row"><input type="radio" name="search-category" checked={category === "all"} onChange={() => setCategory("all")} /><span>All categories</span></label>
        {categories.map((item) => (
          <label className="radio-row" key={item.id}><input type="radio" name="search-category" checked={category === item.id} onChange={() => setCategory(item.id)} /><span>{item.name}</span></label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Availability</legend>
        <label className="check-row"><input type="checkbox" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} /><span>Available now</span></label>
      </fieldset>
      <fieldset><legend>More filters</legend><button className="quiet-filter" type="button">Price & discount</button><button className="quiet-filter" type="button">Delivery district</button></fieldset>
    </aside>
  );

  return (
    <main className="search-results-page">
      <div className="site-container">
        <div className="results-heading">
          <div><p className="eyebrow">Live search · no page change</p><h1>Matches for “{searchQuery}”</h1><p>Every listing matching at least one word is included. Listings matching more words appear first.</p></div>
          <div><span>{results.length} results</span><button className="secondary-button" type="button" onClick={() => setSearchQuery("")}>Clear search</button></div>
        </div>
        <button className="mobile-filter-toggle" type="button" onClick={() => setMobileFilters(true)}><SlidersHorizontal size={18} /> Filters</button>
        <div className="catalog-layout">
          {filterPanel}
          <section>
            {results.length ? (
              <div className="product-grid">{results.map(({ listing }) => <ProductCard key={listing.id} listing={listing} />)}</div>
            ) : (
              <div className="empty-state"><SearchIcon /><h2>No matching listings yet</h2><p>Try a different word, check the spelling or clear one of the filters.</p><button className="primary-button" type="button" onClick={() => setSearchQuery("")}>Return to this page</button></div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function SearchIcon() {
  return <div className="empty-icon" aria-hidden="true">?</div>;
}

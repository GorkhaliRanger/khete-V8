"use client";

import { useMemo } from "react";
import { ProductCard } from "@/components/product-card";
import type { Listing } from "@/data/marketplace";
import { useMarketplace } from "@/components/marketplace-provider";

export function RelatedProducts({ listing }: { listing: Listing }) {
  const { listings } = useMarketplace();

  const related = useMemo(() => {
    const others = listings.filter((item) => item.id !== listing.id && item.available);
    const sameChild = others.filter((item) => item.categoryId === listing.categoryId && item.childCategory === listing.childCategory);
    const sameCategory = others.filter((item) => item.categoryId === listing.categoryId && item.childCategory !== listing.childCategory);
    const rest = others.filter((item) => item.categoryId !== listing.categoryId);
    return [...sameChild, ...sameCategory, ...rest].slice(0, 6);
  }, [listings, listing]);

  if (!related.length) return null;

  return (
    <section className="pdp-related" aria-labelledby="pdp-related-heading">
      <div className="pdp-related-head">
        <div>
          <h2 id="pdp-related-heading">Pairs well in the field</h2>
          <p>Farmers who looked at this also added these to their kit</p>
        </div>
      </div>
      <div className="product-grid product-grid-compact pdp-related-grid">
        {related.map((item) => <ProductCard key={item.id} listing={item} />)}
      </div>
    </section>
  );
}

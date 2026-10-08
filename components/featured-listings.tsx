"use client";

import { ProductCard } from "./product-card";
import { useMarketplace } from "./marketplace-provider";

export function FeaturedListings() {
  const { listings } = useMarketplace();
  const newArrivals = listings
    .filter((listing) => listing.newArrival)
    .sort((a, b) => new Date(b.newArrivalAt ?? 0).getTime() - new Date(a.newArrivalAt ?? 0).getTime());
  const featured = listings.filter((listing) => listing.featured);
  const visible = [...new Map([...newArrivals, ...featured, ...listings].map((listing) => [listing.id, listing])).values()].slice(0, 4);

  return <div className="product-grid">{visible.map((listing) => <ProductCard key={listing.id} listing={listing} />)}</div>;
}

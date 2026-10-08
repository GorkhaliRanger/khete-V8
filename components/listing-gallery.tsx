"use client";
/* eslint-disable @next/next/no-img-element -- Supabase gallery images intentionally reuse the single approved master file. */

import { useState } from "react";
import type { Listing } from "@/data/marketplace";
import { ProductVisual } from "@/components/product-visual";

export function ListingGallery({ listing }: { listing: Listing }) {
  const images = listing.images ?? [];
  const primaryIndex = Math.max(0, images.findIndex((image) => image.primary));
  const [selected, setSelected] = useState(primaryIndex);

  if (!images.length) return <ProductVisual listing={listing} large />;
  const current = images[selected] ?? images[0];
  return (
    <div className="listing-gallery">
      <div className="listing-gallery-main"><img src={current.url} alt={current.alt} /></div>
      {images.length > 1 ? <div className="listing-gallery-thumbs">{images.map((image, index) => <button className={index === selected ? "selected" : ""} type="button" key={image.url} onClick={() => setSelected(index)}><img src={image.url} alt={image.alt} /></button>)}</div> : null}
    </div>
  );
}

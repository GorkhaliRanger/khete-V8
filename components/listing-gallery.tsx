"use client";
/* eslint-disable @next/next/no-img-element -- Supabase gallery images intentionally reuse the single approved master file. */

import { useState } from "react";
import type { Listing } from "@/data/marketplace";
import { ProductVisual } from "@/components/product-visual";

export function ListingGallery({ listing }: { listing: Listing }) {
  const images = listing.images ?? [];
  const primaryIndex = Math.max(0, images.findIndex((image) => image.primary));
  const [selected, setSelected] = useState(primaryIndex);
  const [zoomVisible, setZoomVisible] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });

  if (!images.length) return <ProductVisual listing={listing} large />;
  const current = images[selected] ?? images[0];

  const trackCursor = (event: React.MouseEvent<HTMLImageElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100));
    setZoomPosition({ x, y });
  };

  return (
    <div className="listing-gallery">
      <div className="listing-gallery-main">
        <img
          src={current.url}
          alt={current.alt}
          onMouseEnter={() => setZoomVisible(true)}
          onMouseLeave={() => setZoomVisible(false)}
          onMouseMove={trackCursor}
        />
      </div>
      {zoomVisible ? (
        <div
          className="listing-gallery-zoom"
          aria-hidden="true"
          style={{ backgroundImage: `url("${current.url}")`, backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%` }}
        />
      ) : null}
      {images.length > 1 ? <div className="listing-gallery-thumbs">{images.map((image, index) => <button className={index === selected ? "selected" : ""} type="button" key={image.url} onClick={() => setSelected(index)}><img src={image.url} alt={image.alt} /></button>)}</div> : null}
    </div>
  );
}

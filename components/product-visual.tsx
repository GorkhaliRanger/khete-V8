/* eslint-disable @next/next/no-img-element -- Product cards intentionally reuse the approved master image URL. */
import { Milk, Sprout, Tractor, Wheat, Wrench } from "lucide-react";
import type { Listing } from "@/data/marketplace";

const icons = {
  machinery: Tractor,
  produce: Sprout,
  "seeds-inputs": Wheat,
  livestock: Milk,
  services: Wrench,
};

export function ProductVisual({ listing, large = false }: { listing: Listing; large?: boolean }) {
  const Icon = icons[listing.categoryId as keyof typeof icons] ?? Sprout;
  const image = listing.images?.find((item) => item.primary) ?? listing.images?.[0];
  if (image) {
    return <div className={`product-visual product-photo ${large ? "product-visual-large" : ""}`}><img src={image.url} alt={image.alt} /></div>;
  }
  return (
    <div className={`product-visual tone-${listing.tone} ${large ? "product-visual-large" : ""}`} aria-hidden="true">
      <span className="visual-orbit visual-orbit-one" />
      <span className="visual-orbit visual-orbit-two" />
      <Icon strokeWidth={1.35} />
      <span className="visual-label">{listing.grandchildCategory}</span>
    </div>
  );
}

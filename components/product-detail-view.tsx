"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, CalendarDays, Heart, MapPin, Minus, Plus, ShieldCheck, ShoppingCart, Truck } from "lucide-react";
import { ListingGallery } from "@/components/listing-gallery";
import { EntityCertificates } from "@/components/entity-certificates";
import { PublicReviews } from "@/components/public-reviews";
import { formatNpr } from "@/data/marketplace";
import { useMarketplace } from "@/components/marketplace-provider";
import { makeWishlistItemKey } from "@/lib/wishlist";

export function ProductDetailView({ slug }: { slug: string }) {
  const router = useRouter();
  const { categories, listings, listingsReady, addToCart, wishlist, toggleWishlist } = useMarketplace();
  const listing = listings.find((item) => item.slug === slug);
  const [quantity, setQuantity] = useState(1);
  const [variantQuantities, setVariantQuantities] = useState<Record<string, number>>({});
  const selectedVariantCount = useMemo(
    () => Object.values(variantQuantities).reduce((total, quantity) => total + Math.max(0, quantity), 0),
    [variantQuantities],
  );
  const selectedVariantTotal = useMemo(
    () => listing?.variants?.reduce((total, variant) => total + variant.price * Math.max(0, variantQuantities[variant.id] ?? 0), 0) ?? 0,
    [listing, variantQuantities],
  );

  if (!listing && !listingsReady) {
    return <main className="simple-page"><div className="site-container empty-state"><h1>Loading listing…</h1></div></main>;
  }

  if (!listing) {
    return <main className="simple-page"><div className="site-container empty-state"><h1>This listing is not available.</h1><p>It may be a draft, archived, or no longer published.</p><Link className="primary-button" href="/products">Return to products</Link></div></main>;
  }

  const category = categories.find((item) => item.id === listing.categoryId);
  const hasVariants = Boolean(listing.variants?.length);
  const action = hasVariants ? "Add selected to cart" : listing.type === "livestock" ? "Reserve & enquire" : listing.type === "service" || listing.type === "rental" ? "Check availability" : "Add to cart";
  const canAdd = hasVariants || listing.type === "product" || listing.type === "produce";
  const saved = wishlist.has(listing.id);

  const returnToShoppingPage = () => {
    const savedReturn = sessionStorage.getItem("khete-product-return");
    sessionStorage.removeItem("khete-product-return");
    const safeReturn = savedReturn?.startsWith("/") && !savedReturn.startsWith("//") && !savedReturn.startsWith("/products/")
      ? savedReturn
      : "/products";
    router.push(safeReturn);
  };

  const addSelectedVariants = () => {
    if (!listing.variants) return;
    listing.variants.forEach((variant) => {
      const quantity = variantQuantities[variant.id] ?? 0;
      if (quantity > 0) addToCart(listing.id, quantity, variant);
    });
    setVariantQuantities({});
    returnToShoppingPage();
  };

  const addSingleListing = () => {
    addToCart(listing.id, quantity);
    setQuantity(1);
    returnToShoppingPage();
  };

  return (
    <main className="product-detail-page">
      <div className="site-container">
        <Link className="back-link" href="/products"><ArrowLeft size={17} /> Back to products</Link>
        <div className="breadcrumbs"><Link href="/products">Products</Link><span>/</span><Link href={`/shop/${listing.categoryId}`}>{category?.name}</Link><span>/</span><span>{listing.grandchildCategory}</span></div>
        <section className="product-detail-layout">
          <ListingGallery key={listing.id} listing={listing} />
          <div className="product-info">
            <p className="eyebrow">{listing.type} · {listing.grandchildCategory}</p>
            {listing.newArrival ? <span className="detail-new-arrival">New Arrival</span> : null}
            <h1>{listing.name}</h1><p className="nepali-name">{listing.nameNe}</p>
            <p className="detail-description">{listing.description}</p>
            {listing.offerTitle ? <div className="product-offer-caption">{listing.offerTitle}</div> : null}
            <div className="detail-price">{hasVariants ? <span>From</span> : null}<strong>{listing.price ? formatNpr(listing.price) : listing.priceLabel}</strong>{listing.compareAt ? <del>{formatNpr(listing.compareAt)}</del> : null}{listing.unit ? <span>/ {listing.unit}</span> : null}</div>
            {listing.variants?.length ? (
              <section className="variant-purchase-panel" aria-labelledby="variant-heading">
                <div className="variant-purchase-header"><div><p className="eyebrow">Choose options</p><h2 id="variant-heading">Build your order</h2></div><span>{selectedVariantCount} selected</span></div>
                <div className="variant-purchase-list">
                  {listing.variants.map((variant) => {
                    const quantity = variantQuantities[variant.id] ?? 0;
                    const maximum = Math.max(0, variant.stockQuantity);
                    const variantSaved = wishlist.has(makeWishlistItemKey(listing.id, variant.id));
                    return (
                      <div className={`variant-purchase-row ${quantity > 0 ? "selected" : ""}`} key={variant.id}>
                        <div className="variant-purchase-choice"><div className="variant-name-line"><strong>{variant.name}</strong>{variant.newArrival ? <b>New</b> : null}<button className={`variant-save-button ${variantSaved ? "is-saved" : ""}`} type="button" onClick={() => void toggleWishlist(listing.id, variant.id)} aria-label={variantSaved ? `Remove ${variant.name} from wishlist` : `Save ${variant.name} to wishlist`} title={variantSaved ? "Remove saved option" : "Save this option"}><Heart size={15} fill={variantSaved ? "currentColor" : "none"} /></button></div>{variant.nameNe ? <small>{variant.nameNe}</small> : null}{variant.offerTitle ? <em>{variant.offerTitle}</em> : null}<span>{formatNpr(variant.price)}{variant.compareAt ? <del>{formatNpr(variant.compareAt)}</del> : null}{variant.unit ? ` / ${variant.unit}` : ""}</span></div>
                        <div className="variant-purchase-quantity"><span>Qty</span><div className="quantity-stepper"><button type="button" aria-label={`Decrease ${variant.name} quantity`} disabled={!variant.available || quantity === 0} onClick={() => setVariantQuantities((current) => ({ ...current, [variant.id]: Math.max(0, quantity - 1) }))}><Minus size={15} /></button><input aria-label={`${variant.name} quantity`} type="number" min="0" max={maximum || undefined} value={quantity} disabled={!variant.available} onChange={(event) => { const next = Math.max(0, Math.min(maximum || Number.MAX_SAFE_INTEGER, Number(event.target.value) || 0)); setVariantQuantities((current) => ({ ...current, [variant.id]: Math.floor(next) })); }} /><button type="button" aria-label={`Increase ${variant.name} quantity`} disabled={!variant.available || quantity >= maximum} onClick={() => setVariantQuantities((current) => ({ ...current, [variant.id]: Math.min(maximum, quantity + 1) }))}><Plus size={15} /></button></div><small>{quantity > 0 ? `${formatNpr(variant.price * quantity)} · ` : ""}{variant.available ? `${maximum} available` : "Unavailable"}</small></div>
                      </div>
                    );
                  })}
                </div>
                <div className="variant-selection-summary" aria-live="polite"><span><small>Purchase total</small>Each selected variety becomes a separate cart item.</span><strong>{formatNpr(selectedVariantTotal)}</strong></div>
              </section>
            ) : null}
            {canAdd && !hasVariants ? <section className="product-quantity-panel" aria-label="Choose quantity"><div><strong>Quantity</strong><span>Select how many {listing.unit ? `${listing.unit}s` : "items"} to add</span></div><div className="quantity-stepper quantity-stepper-large"><button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((current) => Math.max(1, current - 1))}><Minus size={17} /></button><input aria-label="Product quantity" type="number" min="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.floor(Number(event.target.value) || 1)))} /><button type="button" aria-label="Increase quantity" onClick={() => setQuantity((current) => current + 1)}><Plus size={17} /></button></div></section> : null}
            <div className="availability-line"><span><BadgeCheck /> {listing.available ? "Available now" : "Currently unavailable"}</span><span><MapPin /> {listing.district.length} delivery districts</span></div>
            <div className="detail-actions"><button className="primary-button" type="button" disabled={!listing.available || (hasVariants && selectedVariantCount === 0)} onClick={() => { if (!canAdd) return; if (hasVariants) addSelectedVariants(); else addSingleListing(); }}>{listing.type === "service" || listing.type === "rental" ? <CalendarDays size={19} /> : <ShoppingCart size={19} />}{action}</button><button className="secondary-button" type="button" onClick={() => void toggleWishlist(listing.id)}><Heart size={19} fill={saved ? "currentColor" : "none"} /> {saved ? "Saved" : "Save"}</button></div>
            <div className="detail-assurances"><span><ShieldCheck /> Verified information</span><span><Truck /> Delivery confirmed at checkout</span></div>
          </div>
        </section>
        <section className="product-detail-lower"><div><p className="eyebrow">Product details</p><h2>What you should know</h2><p>{listing.description}</p></div><div className="spec-list"><h3>Specifications</h3>{listing.specifications.map((specification) => <div key={specification}><BadgeCheck size={17} /> {specification}</div>)}</div><aside><h3>Delivery coverage</h3><p>{listing.district.join(" · ") || "Coverage confirmed during enquiry."}</p><p>Final delivery fee and timing are calculated from the customer&apos;s address.</p></aside></section>
        <EntityCertificates targetType="listing" targetId={listing.id} />
        <PublicReviews targetType="listing" targetId={listing.id} />
      </div>
    </main>
  );
}

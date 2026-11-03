"use client";

/* eslint-disable @next/next/no-img-element -- Khet E logo served from public assets. */

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Banknote, CalendarDays, Heart, MapPin, Minus, Plus, RotateCcw, ShieldCheck, ShoppingCart, Store, Truck, Zap } from "lucide-react";
import { ListingGallery } from "@/components/listing-gallery";
import { EntityCertificates } from "@/components/entity-certificates";
import { PublicReviews } from "@/components/public-reviews";
import { PdpRatingSummary } from "@/components/pdp-rating-summary";
import { ProductQna } from "@/components/product-qna";
import { RelatedProducts } from "@/components/related-products";
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
  const isBooking = listing.type === "service" || listing.type === "rental" || listing.type === "livestock";
  const action = hasVariants ? "Add selected to cart" : listing.type === "livestock" ? "Reserve & enquire" : isBooking ? "Check availability" : "Add to Cart";
  const canAdd = hasVariants || listing.type === "product" || listing.type === "produce";
  const saved = wishlist.has(listing.id);
  const discount = listing.price && listing.compareAt && listing.compareAt > listing.price
    ? Math.round((1 - listing.price / listing.compareAt) * 100)
    : 0;

  const goToShoppingPage = () => {
    const savedReturn = sessionStorage.getItem("khete-product-return");
    sessionStorage.removeItem("khete-product-return");
    const safeReturn = savedReturn?.startsWith("/") && !savedReturn.startsWith("//") && !savedReturn.startsWith("/products/")
      ? savedReturn
      : "/products";
    router.push(safeReturn);
  };

  const addSelectionToCart = () => {
    if (hasVariants) {
      listing.variants?.forEach((variant) => {
        const variantQuantity = variantQuantities[variant.id] ?? 0;
        if (variantQuantity > 0) addToCart(listing.id, variantQuantity, variant);
      });
      setVariantQuantities({});
    } else {
      addToCart(listing.id, quantity);
      setQuantity(1);
    }
  };

  const handleAddToCart = () => {
    if (!canAdd) return;
    addSelectionToCart();
    goToShoppingPage();
  };

  const handleBuyNow = () => {
    if (!canAdd) return;
    addSelectionToCart();
    router.push("/checkout");
  };

  return (
    <main className="product-detail-page pdp">
      <div className="site-container">
        <nav className="breadcrumbs pdp-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link><span>/</span>
          <Link href="/products">Products</Link><span>/</span>
          <Link href={`/shop/${listing.categoryId}`}>{category?.name ?? listing.childCategory}</Link><span>/</span>
          <span aria-current="page">{listing.name}</span>
        </nav>

        <section className="pdp-card">
          <div className="pdp-gallery">
            <ListingGallery key={listing.id} listing={listing} />
          </div>

          <div className="pdp-info">
            <h1>{listing.name}{listing.nameNe ? <span className="pdp-name-ne">{listing.nameNe}</span> : null}</h1>
            <div className="pdp-rating-row">
              <PdpRatingSummary listingId={listing.id} />
              {listing.newArrival ? <span className="detail-new-arrival">New Arrival</span> : null}
            </div>
            <p className="pdp-brand-line">
              <Store size={14} /> Brand: <Link href="/products">Khet E Official</Link>
              <i>|</i>
              <Link href={`/shop/${listing.categoryId}`}>More {listing.childCategory} from Khet E</Link>
            </p>

            <div className="pdp-price-block">
              {hasVariants ? <span className="pdp-price-from">From</span> : null}
              <strong>{listing.price ? formatNpr(listing.price) : listing.priceLabel}</strong>
              {listing.compareAt ? <del>{formatNpr(listing.compareAt)}</del> : null}
              {discount ? <span className="pdp-discount">-{discount}%</span> : null}
              {listing.unit ? <span className="pdp-unit">/ {listing.unit}</span> : null}
              {listing.offerTitle ? <em className="pdp-offer-tag">{listing.offerTitle}</em> : null}
            </div>

            {listing.variants?.length ? (
              <section className="variant-purchase-panel" aria-labelledby="variant-heading">
                <div className="variant-purchase-header"><div><p className="eyebrow">Choose options</p><h2 id="variant-heading">Build your order</h2></div><span>{selectedVariantCount} selected</span></div>
                <div className="variant-purchase-list">
                  {listing.variants.map((variant) => {
                    const variantQuantity = variantQuantities[variant.id] ?? 0;
                    const maximum = Math.max(0, variant.stockQuantity);
                    const variantSaved = wishlist.has(makeWishlistItemKey(listing.id, variant.id));
                    return (
                      <div className={`variant-purchase-row ${variantQuantity > 0 ? "selected" : ""}`} key={variant.id}>
                        <div className="variant-purchase-choice"><div className="variant-name-line"><strong>{variant.name}</strong>{variant.newArrival ? <b>New</b> : null}<button className={`variant-save-button ${variantSaved ? "is-saved" : ""}`} type="button" onClick={() => void toggleWishlist(listing.id, variant.id)} aria-label={variantSaved ? `Remove ${variant.name} from wishlist` : `Save ${variant.name} to wishlist`} title={variantSaved ? "Remove saved option" : "Save this option"}><Heart size={15} fill={variantSaved ? "currentColor" : "none"} /></button></div>{variant.nameNe ? <small>{variant.nameNe}</small> : null}{variant.offerTitle ? <em>{variant.offerTitle}</em> : null}<span>{formatNpr(variant.price)}{variant.compareAt ? <del>{formatNpr(variant.compareAt)}</del> : null}{variant.unit ? ` / ${variant.unit}` : ""}</span></div>
                        <div className="variant-purchase-quantity"><span>Qty</span><div className="quantity-stepper"><button type="button" aria-label={`Decrease ${variant.name} quantity`} disabled={!variant.available || variantQuantity === 0} onClick={() => setVariantQuantities((current) => ({ ...current, [variant.id]: Math.max(0, variantQuantity - 1) }))}><Minus size={15} /></button><input aria-label={`${variant.name} quantity`} type="number" min="0" max={maximum || undefined} value={variantQuantity} disabled={!variant.available} onChange={(event) => { const next = Math.max(0, Math.min(maximum || Number.MAX_SAFE_INTEGER, Number(event.target.value) || 0)); setVariantQuantities((current) => ({ ...current, [variant.id]: Math.floor(next) })); }} /><button type="button" aria-label={`Increase ${variant.name} quantity`} disabled={!variant.available || variantQuantity >= maximum} onClick={() => setVariantQuantities((current) => ({ ...current, [variant.id]: Math.min(maximum, variantQuantity + 1) }))}><Plus size={15} /></button></div><small>{variantQuantity > 0 ? `${formatNpr(variant.price * variantQuantity)} · ` : ""}{variant.available ? `${maximum} available` : "Unavailable"}</small></div>
                      </div>
                    );
                  })}
                </div>
                {selectedVariantCount > 0 ? <div className="variant-selection-summary" aria-live="polite"><span><small>Purchase total</small>Each selected variety becomes a separate cart item.</span><strong>{formatNpr(selectedVariantTotal)}</strong></div> : null}
              </section>
            ) : null}

            {canAdd && !hasVariants ? (
              <div className="pdp-quantity-row">
                <span>Quantity</span>
                <div className="quantity-stepper">
                  <button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((current) => Math.max(1, current - 1))}><Minus size={15} /></button>
                  <input aria-label="Product quantity" type="number" min="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.floor(Number(event.target.value) || 1)))} />
                  <button type="button" aria-label="Increase quantity" onClick={() => setQuantity((current) => current + 1)}><Plus size={15} /></button>
                </div>
                <small className={listing.available ? "pdp-in-stock" : "pdp-out-stock"}>{listing.available ? "In stock" : "Currently unavailable"}</small>
                {listing.price && quantity > 1 ? <strong className="pdp-qty-total">Total: {formatNpr(listing.price * quantity)}</strong> : null}
              </div>
            ) : null}

            <div className="pdp-actions">
              {canAdd ? <button className="pdp-buy-now" type="button" disabled={!listing.available || (hasVariants && selectedVariantCount === 0)} onClick={handleBuyNow}><Zap size={18} /> Buy Now</button> : null}
              <button className="pdp-add-cart" type="button" disabled={!listing.available || (hasVariants && selectedVariantCount === 0)} onClick={handleAddToCart}>
                {isBooking ? <CalendarDays size={18} /> : <ShoppingCart size={18} />}{action}
              </button>
              <button className={`pdp-save ${saved ? "is-saved" : ""}`} type="button" onClick={() => void toggleWishlist(listing.id)} aria-label={saved ? "Remove from wishlist" : "Save to wishlist"} title={saved ? "Saved" : "Save to wishlist"}>
                <Heart size={19} fill={saved ? "currentColor" : "none"} />
              </button>
            </div>
          </div>

          <aside className="pdp-side">
            <section className="pdp-side-block">
              <h3>Delivery</h3>
              <p><MapPin size={16} /><span>Deliver to <strong>{listing.district.length ? `${listing.district[0]}${listing.district.length > 1 ? ` & ${listing.district.length - 1} more districts` : ""}` : "your district"}</strong></span></p>
              <p><Truck size={16} /><span>Standard delivery<small>Fee & timing confirmed at checkout</small></span></p>
              <p><Banknote size={16} /><span>Cash on Delivery<small>Available on eligible orders</small></span></p>
            </section>
            <section className="pdp-side-block">
              <h3>Return &amp; Assurance</h3>
              <p><RotateCcw size={16} /><span>7-day easy returns<small>Unused items, damaged or not as described</small></span></p>
              <p><ShieldCheck size={16} /><span>Verified by Khet E<small>Checked by field officers before listing</small></span></p>
              <p><BadgeCheck size={16} /><span>{listing.type === "rental" || listing.type === "service" ? "Service guarantee" : "Genuine product"}<small>{listing.type === "rental" || listing.type === "service" ? "Rescheduled free if we miss the slot" : "Sourced from registered suppliers"}</small></span></p>
            </section>
            <section className="pdp-side-block pdp-seller-block">
              <h3>Sold by</h3>
              <div className="pdp-seller">
                <img src="/brand/khet-e-main-logo.png" alt="Khet E logo" />
                <div>
                  <strong>Khet E Official Store</strong>
                  <small>Verified marketplace seller</small>
                </div>
              </div>
              <div className="pdp-seller-stats">
                <div><strong>98%</strong><small>Positive ratings</small></div>
                <div><strong>96%</strong><small>Ship on time</small></div>
                <div><strong>100%</strong><small>Response rate</small></div>
              </div>
              <Link className="pdp-seller-link" href="/products">Visit Khet E store</Link>
            </section>
          </aside>
        </section>

        <section className="pdp-details">
          <div className="pdp-details-main">
            <h2>Product details of {listing.name}</h2>
            <p>{listing.description}</p>
          </div>
          <div className="pdp-details-specs">
            <h3>Specifications of {listing.name}</h3>
            <ul>
              {listing.specifications.map((specification) => <li key={specification}><BadgeCheck size={15} /> {specification}</li>)}
            </ul>
          </div>
        </section>

        <EntityCertificates targetType="listing" targetId={listing.id} />
        <PublicReviews targetType="listing" targetId={listing.id} />
        <ProductQna listing={listing} />
        <RelatedProducts listing={listing} />
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { ArrowRight, Heart, LoaderCircle, LogIn, ShoppingCart, Trash2 } from "lucide-react";
import { formatNpr } from "@/data/marketplace";
import { parseWishlistItemKey } from "@/lib/wishlist";
import { useMarketplace } from "./marketplace-provider";
import { ProductCard } from "./product-card";
import { ProductVisual } from "./product-visual";

export function WishlistView() {
  const {
    wishlist,
    wishlistReady,
    wishlistError,
    listings,
    listingsReady,
    user,
    openLogin,
    toggleWishlist,
    addToCart,
  } = useMarketplace();

  const entries = [...wishlist].flatMap((itemKey) => {
    const parsed = parseWishlistItemKey(itemKey);
    if (!parsed) return [];
    const listing = listings.find((item) => item.id === parsed.listingId);
    if (!listing) return [];
    const variant = parsed.variantId
      ? listing.variants?.find((item) => item.id === parsed.variantId)
      : undefined;
    if (parsed.variantId && !variant) return [];
    return [{ itemKey, listing, variant }];
  });

  if (!wishlistReady || !listingsReady) {
    return (
      <main className="wishlist-page">
        <div className="site-container wishlist-loading"><LoaderCircle className="admin-spinner" /> Loading your saved items…</div>
      </main>
    );
  }

  return (
    <main className="wishlist-page">
      <section className="site-container wishlist-hero">
        <div>
          <p className="eyebrow">Saved for later</p>
          <h1>Your wishlist</h1>
          <p>Keep products, services and individual product options together while you compare what your farm needs.</p>
        </div>
        <span><Heart fill="currentColor" /> {entries.length} saved</span>
      </section>

      <div className="site-container wishlist-content">
        {wishlistError ? <div className="wishlist-message wishlist-message-error">{wishlistError}</div> : null}
        {!user ? (
          <div className="wishlist-message">
            <div><LogIn /><span><strong>Saved on this device</strong><small>Log in to keep these items available across your devices.</small></span></div>
            <button className="secondary-button" type="button" onClick={openLogin}>Login or register</button>
          </div>
        ) : (
          <div className="wishlist-message wishlist-message-synced">
            <Heart /><span><strong>Connected to your account</strong><small>Changes to live catalogue items are saved automatically.</small></span>
          </div>
        )}

        {!entries.length ? (
          <div className="empty-state wishlist-empty">
            <Heart />
            <h2>Your wishlist is empty.</h2>
            <p>Use the heart on any product card, product page or individual variant to save it here.</p>
            <Link className="primary-button" href="/products">Browse products <ArrowRight size={18} /></Link>
          </div>
        ) : (
          <>
            <div className="wishlist-section-heading">
              <div><p className="eyebrow">Your selections</p><h2>Saved products and options</h2></div>
              <Link className="text-button" href="/products">Continue browsing <ArrowRight size={17} /></Link>
            </div>
            <section className="wishlist-grid" aria-label="Saved marketplace items">
              {entries.map(({ itemKey, listing, variant }) => variant ? (
                <article className="wishlist-variant-card" key={itemKey}>
                  <Link className="wishlist-variant-media" href={`/products/${listing.slug}`} aria-label={`View ${listing.name}, ${variant.name}`}>
                    <ProductVisual listing={listing} />
                    {variant.newArrival ? <span className="new-arrival-pill">New option</span> : null}
                  </Link>
                  <div className="wishlist-variant-copy">
                    <p className="eyebrow">Saved option</p>
                    <Link href={`/products/${listing.slug}`}><h3>{listing.name}</h3></Link>
                    <strong>{variant.name}</strong>
                    {variant.nameNe ? <small>{variant.nameNe}</small> : null}
                    {variant.offerTitle ? <em>{variant.offerTitle}</em> : null}
                    <div className="wishlist-variant-price">
                      <b>{formatNpr(variant.price)}</b>
                      {variant.compareAt ? <del>{formatNpr(variant.compareAt)}</del> : null}
                      {variant.unit ? <span>/ {variant.unit}</span> : null}
                    </div>
                    <p>{variant.available ? `${Math.max(0, variant.stockQuantity)} available` : "Currently unavailable"}</p>
                    <div className="wishlist-variant-actions">
                      <button className="primary-button" type="button" disabled={!variant.available} onClick={() => addToCart(listing.id, 1, variant)}><ShoppingCart size={17} /> Add one to cart</button>
                      <button className="secondary-button" type="button" onClick={() => void toggleWishlist(listing.id, variant.id)}><Trash2 size={16} /> Remove</button>
                    </div>
                  </div>
                </article>
              ) : <ProductCard listing={listing} key={itemKey} />)}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

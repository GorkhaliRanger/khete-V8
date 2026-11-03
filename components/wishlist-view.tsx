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

  const wishlistedIds = new Set(entries.map((entry) => entry.listing.id));
  const savedCategoryIds = new Set(entries.map((entry) => entry.listing.categoryId));
  const suggestions = listings
    .filter((listing) => !wishlistedIds.has(listing.id) && listing.available && (listing.type === "product" || listing.type === "produce"))
    .map((listing) => ({ listing, score: savedCategoryIds.has(listing.categoryId) ? 0 : 1 }))
    .sort((left, right) => left.score - right.score || left.listing.name.localeCompare(right.listing.name))
    .slice(0, 4)
    .map((entry) => entry.listing);

  if (!wishlistReady || !listingsReady) {
    return (
      <main className="wishlist-page">
        <div className="site-container wishlist-loading"><LoaderCircle className="admin-spinner" /> Loading your saved items…</div>
      </main>
    );
  }

  return (
    <main className="wishlist-page">
      <div className="site-container wishlist-content">
        {wishlistError ? <div className="wishlist-message wishlist-message-error">{wishlistError}</div> : null}
        {!user ? (
          <div className="wishlist-message">
            <div><LogIn /><span><strong>Saved on this device</strong><small>Log in to keep these items available across your devices.</small></span></div>
            <button className="secondary-button" type="button" onClick={openLogin}>Login or register</button>
          </div>
        ) : (
          <div className="wishlist-message wishlist-message-synced">
            <Heart /><span><strong>Wishlist — {entries.length} saved</strong><small>Changes to live catalogue items are saved automatically.</small></span>
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
          <section className="wishlist-tile-grid" aria-label="Saved marketplace items">
            {entries.map(({ itemKey, listing, variant }) => {
              const chosenVariant = variant ?? (listing.variants?.length ? listing.variants.find((item) => item.available) ?? listing.variants[0] : undefined);
              const price = variant?.price ?? listing.price;
              const regularPrice = variant?.regularPrice ?? listing.regularPrice;
              const compareAt = variant?.compareAt ?? listing.compareAt;
              const offerTitle = variant?.offerTitle ?? listing.offerTitle;
              const available = variant ? variant.available : listing.available;
              const stockQuantity = variant ? variant.stockQuantity : undefined;
              const moveToCart = () => {
                if (chosenVariant) addToCart(listing.id, 1, chosenVariant);
                else addToCart(listing.id);
              };
              return (
                <article className="wishlist-tile" key={itemKey}>
                  <Link className="wishlist-tile-media" href={`/products/${listing.slug}`} aria-label={`View ${listing.name}${variant ? `, ${variant.name}` : ""}`}>
                    <ProductVisual listing={listing} />
                    {offerTitle ? <span className="wishlist-tile-offer">{offerTitle}</span> : null}
                  </Link>
                  <div className="wishlist-tile-copy">
                    {variant ? <p className="eyebrow">Saved option</p> : <p className="eyebrow">{listing.childCategory}</p>}
                    <Link href={`/products/${listing.slug}`}><h3>{listing.name}</h3></Link>
                    {variant ? <strong>{variant.name}</strong> : null}
                    <div className="wishlist-tile-price">
                      <b>{price !== undefined ? formatNpr(price) : listing.priceLabel || "Price on request"}</b>
                      {regularPrice !== undefined && price !== undefined && price < regularPrice ? <del>{formatNpr(regularPrice)}</del> : null}
                      {compareAt && !(regularPrice !== undefined && price !== undefined && price < regularPrice) ? <del>{formatNpr(compareAt)}</del> : null}
                    </div>
                    <small className={available ? "wishlist-tile-stock" : "wishlist-tile-stock wishlist-tile-stock-out"}>{available ? `${stockQuantity !== undefined ? `${Math.max(0, Math.floor(stockQuantity))} available` : "Available now"}` : "Currently unavailable"}</small>
                    <div className="wishlist-tile-actions">
                      <button className="primary-button" type="button" disabled={!available} onClick={moveToCart}><ShoppingCart size={16} /> Add to cart</button>
                      <button className="cart-remove" type="button" onClick={() => void toggleWishlist(listing.id, variant?.id)}><Trash2 size={15} /> Remove</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {suggestions.length ? (
          <section className="wishlist-suggestions">
            <div className="wishlist-section-heading">
              <div><p className="eyebrow">Picked for you</p><h2>You may also like</h2></div>
              <Link className="text-button" href="/products">View all products <ArrowRight size={17} /></Link>
            </div>
            <div className="product-grid">{suggestions.map((listing) => <ProductCard key={listing.id} listing={listing} />)}</div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

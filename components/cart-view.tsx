"use client";

import Link from "next/link";
import { ArrowRight, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { formatNpr } from "@/data/marketplace";
import { useMarketplace } from "./marketplace-provider";
import { ProductVisual } from "./product-visual";

export function CartView() {
  const { cart, listings, updateCartQuantity, removeFromCart } = useMarketplace();
  const lines = cart.flatMap((line) => {
    const listing = listings.find((item) => item.id === line.listingId);
    return listing ? [{ ...line, listing }] : [];
  });
  const subtotal = lines.reduce((total, line) => {
    const price = line.unitPrice ?? line.listing.price;
    return price === undefined ? total : total + price * line.quantity;
  }, 0);
  const itemCount = lines.reduce((total, line) => total + line.quantity, 0);
  const quoteCount = lines.filter((line) => line.unitPrice === undefined && line.listing.price === undefined).length;

  if (!lines.length) {
    return <main className="simple-page"><div className="site-container empty-state cart-empty"><ShoppingCart /><h1>Your cart is ready for something useful.</h1><p>Browse produce, equipment and farm services and add what you need.</p><Link className="primary-button" href="/products">Explore products <ArrowRight size={18} /></Link></div></main>;
  }

  return (
    <main className="simple-page"><div className="site-container"><div className="page-heading"><p className="eyebrow">Your order</p><h1>Shopping cart</h1></div><div className="cart-layout"><section className="cart-lines">{lines.map((line) => { const unitPrice = line.unitPrice ?? line.listing.price; const selectedVariant = line.variantId ? line.listing.variants?.find((variant) => variant.id === line.variantId) : undefined; const maximum = selectedVariant ? Math.max(0, Math.floor(selectedVariant.stockQuantity)) : undefined; const changeQuantity = (next: number) => updateCartQuantity(line.id, maximum === undefined ? Math.max(1, next) : Math.min(maximum, Math.max(1, next))); return <article className="cart-line" key={line.id}><Link className="cart-thumb" href={`/products/${line.listing.slug}`}><ProductVisual listing={line.listing} /></Link><div className="cart-line-copy"><Link className="cart-line-name" href={`/products/${line.listing.slug}`}>{line.listing.name}</Link>{line.variantName ? <span className="cart-variant-name">{line.variantName}</span> : null}<p>{line.unitLabel ?? line.listing.unit ?? "Item"}{maximum !== undefined ? ` · ${maximum} available` : ""}</p><div className="cart-line-actions"><div className="quantity-stepper"><button type="button" aria-label={`Decrease ${line.listing.name} quantity`} disabled={line.quantity <= 1} onClick={() => changeQuantity(line.quantity - 1)}><Minus size={15} /></button><input aria-label={`${line.listing.name} quantity`} type="number" min="1" max={maximum} value={line.quantity} onChange={(event) => changeQuantity(Number(event.target.value) || 1)} /><button type="button" aria-label={`Increase ${line.listing.name} quantity`} disabled={maximum !== undefined && line.quantity >= maximum} onClick={() => changeQuantity(line.quantity + 1)}><Plus size={15} /></button></div><button className="cart-remove" type="button" onClick={() => removeFromCart(line.id)}><Trash2 size={15} /> Remove</button></div></div><div className="cart-line-total"><small>{unitPrice !== undefined ? `${formatNpr(unitPrice)} each` : "Price on request"}</small><strong>{unitPrice !== undefined ? formatNpr(unitPrice * line.quantity) : line.listing.priceLabel || "Quotation required"}</strong></div></article>; })}</section><aside className="order-summary"><h2>Order summary</h2><div><span>Items ({itemCount})</span><strong>{formatNpr(subtotal)}</strong></div>{quoteCount ? <div className="cart-quote-note"><span>Quotation items</span><strong>{quoteCount} not priced</strong></div> : null}<div><span>Delivery</span><span>Confirmed after address review</span></div><div className="summary-total"><span>Priced subtotal</span><strong>{formatNpr(subtotal)}</strong></div><Link className="primary-button" href="/checkout">Review checkout <ArrowRight size={18} /></Link><p>{quoteCount ? "Price-on-request items cannot be paid online until a quotation is confirmed. " : ""}You can adjust quantities or remove items before checkout.</p></aside></div></div></main>
  );
}

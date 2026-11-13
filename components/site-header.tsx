"use client";

/* eslint-disable @next/next/no-img-element -- profile photos are stored as local data URLs. */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Headphones,
  Heart,
  Menu,
  Search,
  ShoppingCart,
  UserRound,
  X,
} from "lucide-react";
import { BrandName } from "./brand-name";
import { useMarketplace } from "./marketplace-provider";
import { useState } from "react";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/services", label: "Services" },
  { href: "/deals", label: "Deals", branded: true },
  { href: "/our-story", label: "Our Story" },
  { href: "/support", label: "Contact & Support" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { searchQuery, setSearchQuery, openLogin, wishlist, cartCount, user, authReady, profilePhoto } = useMarketplace();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="utility-bar">
        <div className="site-container utility-inner">
          <span>Delivery available in selected districts</span>
          <div><Link href="/support">Customer support</Link><span aria-hidden="true">·</span><button type="button">English / नेपाली</button></div>
        </div>
      </div>

      <div className="site-container header-main">
        <Link className="brand" href="/" aria-label="khetE home">
          <span className="brand-image" />
          <span className="brand-tagline">From fields to futures</span>
        </Link>

        <nav className={`primary-nav ${mobileOpen ? "is-open" : ""}`} aria-label="Primary navigation">
          {navigation.map((item) => (
            <div className="nav-item" key={item.href}>
              <Link className={`${pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`)) ? "active" : ""}${item.href === "/support" ? " nav-contact-link" : ""}`} href={item.href} onClick={() => setMobileOpen(false)}>
                {item.branded ? <><BrandName /> Deals</> : item.href === "/support" ? <><Headphones size={16} aria-hidden="true" />{item.label}</> : item.label}
              </Link>
            </div>
          ))}
        </nav>

        <div className="header-tools">
          <div className="header-search search-shell">
            <Search aria-hidden="true" />
            <label className="sr-only" htmlFor="marketplace-search">Search every word in products and services</label>
            <input
              id="marketplace-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search marketplace…"
              autoComplete="off"
            />
            {searchQuery ? <button type="button" onClick={() => setSearchQuery("")} aria-label="Clear search"><X size={18} /></button> : null}
          </div>

          <div className="header-actions">
            <button className="icon-button mobile-menu-button" type="button" onClick={() => setMobileOpen((value) => !value)} aria-label={mobileOpen ? "Close menu" : "Open menu"}>
              {mobileOpen ? <X /> : <Menu />}
            </button>
            {user ? (
              <Link className="icon-button account-button signed-in" href="/account" aria-label="Open your account" title={user.email ?? "Your account"}>
                {profilePhoto ? <img className="account-avatar-img" src={profilePhoto} alt="" /> : <UserRound />}
                <span className="account-status-dot" aria-hidden="true" />
              </Link>
            ) : (
              <button className="icon-button account-button" type="button" onClick={openLogin} aria-label="Login or create an account" title="Login or create an account" disabled={!authReady}><UserRound /></button>
            )}
            <Link className="icon-button" href="/wishlist" aria-label={`Wishlist with ${wishlist.size} items`} title="Wishlist">
              <Heart fill={wishlist.size ? "currentColor" : "none"} />
              {wishlist.size ? <span className="action-count">{wishlist.size}</span> : null}
            </Link>
            <Link className="icon-button" href="/cart" aria-label={`Shopping cart with ${cartCount} items`} title="Shopping cart">
              <ShoppingCart />
              {cartCount ? <span className="action-count">{cartCount}</span> : null}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { LoginModal } from "./login-modal";
import { MarketplaceProvider, useMarketplace } from "./marketplace-provider";
import { SearchResults } from "./search-results";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

function Storefront({ children }: { children: React.ReactNode }) {
  const { searchQuery } = useMarketplace();
  return (
    <>
      <SiteHeader />
      {searchQuery.trim() ? <SearchResults /> : children}
      <SiteFooter />
      <Link className="floating-whatsapp" href="/support?channel=whatsapp" title="Customer support"><MessageCircle /><span>Chat</span></Link>
      <LoginModal />
    </>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  return <MarketplaceProvider><Storefront>{children}</Storefront></MarketplaceProvider>;
}

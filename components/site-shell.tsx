"use client";

import { MessageCircle } from "lucide-react";
import { WHATSAPP_CHAT_URL } from "@/lib/contact";
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
      <a className="floating-whatsapp" href={WHATSAPP_CHAT_URL} target="_blank" rel="noopener noreferrer" aria-label="Chat with Khet E on WhatsApp" title="Chat with Khet E on WhatsApp"><MessageCircle aria-hidden="true" /><span>Chat</span></a>
      <LoginModal />
    </>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  return <MarketplaceProvider><Storefront>{children}</Storefront></MarketplaceProvider>;
}

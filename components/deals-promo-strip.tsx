"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isLivePromotion, promotionSelect, type PromotionRow } from "@/lib/promotions";
import { useMarketplace } from "@/components/marketplace-provider";

type StripPromotion = PromotionRow & { href: string };

export function DealsPromoStrip() {
  const { listings, categories } = useMarketplace();
  const [promotion, setPromotion] = useState<StripPromotion | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("promotions")
        .select(promotionSelect)
        .eq("show_on_deals_page", true)
        .order("sort_order", { ascending: true })
        .order("starts_at", { ascending: false });
      if (!mounted) return;
      const row = ((error ? [] : (data ?? [])) as unknown as PromotionRow[]).filter((item) => isLivePromotion(item))[0];
      if (!row) return;
      let href = "/deals";
      if (row.target_type === "listing" && row.target_listing_id) {
        const listing = listings.find((item) => item.id === row.target_listing_id);
        if (listing) href = `/products/${listing.slug}`;
      } else if (row.target_type === "category" && row.target_category_id) {
        const category = categories.find((item) => item.databaseId === row.target_category_id);
        if (category) href = `/shop/${category.id}`;
      }
      setPromotion({ ...row, href });
    };
    void load();
    return () => { mounted = false; };
  }, [listings, categories]);

  if (!promotion) return null;

  return (
    <div className="site-container deals-promo-strip-wrap">
      <Link className="deals-promo-strip" href={promotion.href}>
        <Megaphone size={17} />
        <span className="deals-promo-strip-tag">{promotion.eyebrow_en || "Limited-time value"}</span>
        <strong>{promotion.title_en}</strong>
        {promotion.description_en ? <span className="deals-promo-strip-desc">{promotion.description_en}</span> : null}
        <span className="deals-promo-strip-cta">{promotion.button_label_en} <ArrowRight size={15} /></span>
      </Link>
    </div>
  );
}

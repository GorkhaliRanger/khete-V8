"use client";
/* eslint-disable @next/next/no-img-element -- Promotion images are public Supabase media URLs. */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isLivePromotion, promotionSelect, type PromotionRow } from "@/lib/promotions";
import { useMarketplace } from "@/components/marketplace-provider";
import { BrandName } from "@/components/brand-name";

type Placement = "home" | "deals";

function readableEndDate(value: string | null) {
  if (!value) return "While stocks last";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export function PromotionShowcase({ placement, limit }: { placement: Placement; limit?: number }) {
  const { listings, categories } = useMarketplace();
  const [rows, setRows] = useState<PromotionRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const supabase = createClient();
      const field = placement === "home" ? "show_on_homepage" : "show_on_deals_page";
      const { data, error } = await supabase
        .from("promotions")
        .select(promotionSelect)
        .eq(field, true)
        .order("sort_order", { ascending: true })
        .order("starts_at", { ascending: false });
      if (!mounted) return;
      setRows(error ? [] : (data ?? []) as unknown as PromotionRow[]);
      setLoaded(true);
    };
    void load();
    return () => { mounted = false; };
  }, [placement]);

  const promotions = useMemo(() => rows
    .filter((row) => isLivePromotion(row))
    .slice(0, limit ?? rows.length)
    .map((row) => {
      let href = "/deals";
      if (row.target_type === "listing") {
        const listing = listings.find((item) => item.id === row.target_listing_id);
        if (listing) href = `/products/${listing.slug}`;
      } else if (row.target_type === "category") {
        const category = categories.find((item) => item.databaseId === row.target_category_id);
        if (category) href = `/shop/${category.id}`;
      }
      const imageUrl = row.banner_storage_path
        ? createClient().storage.from("marketplace-media").getPublicUrl(row.banner_storage_path).data.publicUrl
        : "";
      return { ...row, href, imageUrl };
    }), [rows, listings, categories, limit]);

  if (placement === "home" && loaded && !promotions.length) {
    return (
      <section className="compact-promos">
        <div className="site-container promo-grid">
          <Link className="promo-card promo-primary" href="/deals"><span className="eyebrow">This week on <BrandName /></span><h2>Season-ready equipment, priced to move.</h2><span className="promo-link">View <BrandName /> Deals <ArrowRight size={17} /></span></Link>
          <Link className="promo-card" href="/shop/produce"><span className="eyebrow">Fresh arrivals</span><h3>Local produce for homes and businesses.</h3><span className="promo-link">Shop produce <ArrowRight size={17} /></span></Link>
        </div>
      </section>
    );
  }

  if (placement === "deals" && loaded && !promotions.length) return null;

  return (
    <section className={placement === "home" ? "compact-promos" : "active-promotions"}>
      <div className="site-container">
        {placement === "deals" ? <div className="active-promotions-heading"><div><p className="eyebrow">Featured campaigns</p><h2>Offers selected for the season.</h2></div><span><Megaphone /> {promotions.length} active</span></div> : null}
        <div className={`promotion-showcase-grid promotion-count-${Math.min(promotions.length, 3)}`}>
          {promotions.map((promotion, index) => (
            <Link className={`live-promotion-card promotion-theme-${promotion.theme} ${index === 0 ? "promotion-lead" : ""}`} href={promotion.href} key={promotion.id}>
              {promotion.imageUrl ? <img src={promotion.imageUrl} alt="" /> : null}
              <span className="promotion-card-shade" />
              <div className="promotion-card-content">
                <span className="eyebrow">{promotion.eyebrow_en || "khetE promotion"}</span>
                <h2>{promotion.title_en}</h2>
                {promotion.description_en ? <p>{promotion.description_en}</p> : null}
                <footer><strong>{promotion.button_label_en} <ArrowRight /></strong><span><CalendarDays /> {readableEndDate(promotion.ends_at)}</span></footer>
              </div>
            </Link>
          ))}
          {!loaded ? <div className="promotion-loading">Loading current promotions…</div> : null}
        </div>
      </div>
    </section>
  );
}

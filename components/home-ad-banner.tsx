"use client";
/* eslint-disable @next/next/no-img-element -- public Supabase banner uploads have dynamic image URLs. */

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Truck } from "lucide-react";
import { BrandName } from "@/components/brand-name";
import {
  DEFAULT_HOME_AD_BANNER,
  HOME_AD_BANNER_BUCKET,
  HOME_AD_BANNER_KEY,
  parseHomeAdBanner,
  type HomeAdBanner as HomeAdBannerData,
} from "@/lib/home-ad-banner";
import { createClient } from "@/lib/supabase/client";

export function HomeAdBanner() {
  const [banner, setBanner] = useState<HomeAdBannerData>(DEFAULT_HOME_AD_BANNER);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { data, error } = await createClient()
          .from("site_content")
          .select("value_en")
          .eq("key", HOME_AD_BANNER_KEY)
          .maybeSingle();
        if (error) throw error;
        if (mounted && data?.value_en) setBanner(parseHomeAdBanner(data.value_en));
      } catch {
        // Keep the visible default banner if site content is temporarily unavailable.
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  if (!banner.enabled) return null;

  let imageUrl = "";
  if (banner.imagePath) {
    try { imageUrl = createClient().storage.from(HOME_AD_BANNER_BUCKET).getPublicUrl(banner.imagePath).data.publicUrl; }
    catch { /* The branded fallback remains visible. */ }
  }

  const external = banner.buttonHref.startsWith("https://");
  const button = banner.buttonLabel ? (
    <span className="home-ad-button-label">{banner.buttonLabel}<ArrowRight size={17} aria-hidden="true" /></span>
  ) : null;

  return (
    <section className="home-ad-banner" aria-label="Promotion">
      <div className="site-container home-ad-banner-layout">
        <div className="home-ad-banner-copy">
          {banner.eyebrow ? <p className="home-ad-banner-eyebrow"><Truck size={17} aria-hidden="true" />{banner.eyebrow}</p> : null}
          <h2>{banner.headline}</h2>
          <p className="home-ad-banner-body">{banner.body}</p>
          {button ? (external
            ? <a className="home-ad-banner-button" href={banner.buttonHref} target="_blank" rel="noopener noreferrer">{button}</a>
            : <Link className="home-ad-banner-button" href={banner.buttonHref}>{button}</Link>) : null}
        </div>
        <div className={`home-ad-banner-visual${imageUrl ? " has-image" : ""}`} aria-hidden="true">
          {imageUrl ? <img src={imageUrl} alt="" /> : null}
          <div className="home-ad-banner-brand"><BrandName /><span>From Fields to Futures</span></div>
        </div>
      </div>
    </section>
  );
}

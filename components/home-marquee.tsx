"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  HOME_MARQUEE_DEFAULT_EN,
  HOME_MARQUEE_DEFAULT_NE,
  HOME_MARQUEE_KEY,
  siteContentSelect,
  type SiteContentRow,
} from "@/lib/site-content";

export function HomeMarquee() {
  const [english, setEnglish] = useState(HOME_MARQUEE_DEFAULT_EN);
  const [nepali, setNepali] = useState(HOME_MARQUEE_DEFAULT_NE);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data, error } = await createClient().from("site_content")
        .select(siteContentSelect).eq("key", HOME_MARQUEE_KEY).maybeSingle();
      if (!mounted || error || !data) return;
      const row = data as SiteContentRow;
      if (row.value_en?.trim()) setEnglish(row.value_en.trim());
      setNepali(row.value_ne?.trim() ?? "");
    }
    void load();
    return () => { mounted = false; };
  }, []);

  const messages = nepali ? [english, nepali] : [english];
  return (
    <div className="story-marquee home-marquee">
      <p className="sr-only">{messages.join(" — ")}</p>
      <div className="story-marquee-track" aria-hidden="true">
        {[0, 1].map((half) => <div className="story-marquee-half" key={half}>
          {[0, 1, 2].flatMap((repeat) => messages.map((message, index) =>
            <span className={index === 1 ? "np" : undefined} key={`${repeat}-${index}`}>{message}</span>
          ))}
        </div>)}
      </div>
    </div>
  );
}

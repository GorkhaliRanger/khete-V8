"use client";

import Link from "next/link";
import { BookOpenCheck, CalendarDays, Languages, LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BrandName } from "@/components/brand-name";
import {
  formatPolicyDate,
  sitePolicyLabels,
  sitePolicySelect,
  type SitePolicyKey,
  type SitePolicyRow,
} from "@/lib/site-policies";
import { createClient } from "@/lib/supabase/client";

type Language = "en" | "ne";

function PolicyBody({ body }: { body: string }) {
  const blocks = useMemo(() => body.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean), [body]);

  return (
    <div className="policy-body">
      {blocks.map((block, index) => {
        if (block.startsWith("## ")) return <h2 key={`${index}-${block}`}>{block.slice(3)}</h2>;
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        if (lines.every((line) => line.startsWith("- "))) {
          return <ul key={`${index}-${block}`}>{lines.map((line) => <li key={line}>{line.slice(2)}</li>)}</ul>;
        }
        return <p key={`${index}-${block}`}>{lines.join(" ")}</p>;
      })}
    </div>
  );
}

export function PolicyPageView({ policyKey }: { policyKey: SitePolicyKey }) {
  const [document, setDocument] = useState<SitePolicyRow | null>(null);
  const [language, setLanguage] = useState<Language>("en");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("khete-language");
    if (stored === "ne") queueMicrotask(() => setLanguage("ne"));
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data, error: loadError } = await supabase
        .from("site_policy_documents")
        .select(sitePolicySelect)
        .eq("policy_key", policyKey)
        .eq("status", "published")
        .maybeSingle();
      if (!mounted) return;
      if (loadError) setError("This policy is temporarily unavailable. Please contact khetE Support.");
      else setDocument(data as unknown as SitePolicyRow | null);
      setLoading(false);
    };
    void load();
    return () => { mounted = false; };
  }, [policyKey]);

  function changeLanguage(next: Language) {
    setLanguage(next);
    window.localStorage.setItem("khete-language", next);
  }

  const label = sitePolicyLabels[policyKey];
  const nepaliAvailable = Boolean(document?.title_ne && document?.body_ne);
  const useNepali = language === "ne" && nepaliAvailable;
  const title = useNepali ? document?.title_ne : document?.title_en;
  const summary = useNepali ? document?.summary_ne : document?.summary_en;
  const body = useNepali ? document?.body_ne : document?.body_en;

  return (
    <main className="policy-page">
      <section className="policy-hero">
        <div className="site-container policy-hero-inner">
          <div>
            <p className="eyebrow"><ShieldCheck /> Marketplace policies</p>
            <h1>{title || label.en}</h1>
            <p>{summary || "Clear information about using the khetE marketplace."}</p>
          </div>
          <div className="policy-language" aria-label="Policy language">
            <Languages />
            <button className={language === "en" ? "active" : ""} type="button" onClick={() => changeLanguage("en")}>English</button>
            <button className={language === "ne" ? "active" : ""} type="button" onClick={() => changeLanguage("ne")} disabled={!nepaliAvailable}>नेपाली</button>
          </div>
        </div>
      </section>

      <div className="site-container policy-layout">
        <aside className="policy-navigation">
          <p className="eyebrow">Policy centre</p>
          <nav>{Object.entries(sitePolicyLabels).map(([key, item]) => (
            <Link className={key === policyKey ? "active" : ""} href={`/policies/${key}`} key={key}>{language === "ne" ? item.ne : item.en}</Link>
          ))}</nav>
          <Link className="policy-support-link" href="/support">Questions? Contact Support →</Link>
        </aside>

        <article className="policy-document">
          {loading ? <div className="policy-state"><LoaderCircle className="admin-spinner" /> Loading policy…</div> : null}
          {!loading && (error || !document) ? (
            <div className="policy-state policy-state-error">
              <BookOpenCheck />
              <h2>{error || "This policy has not been published yet."}</h2>
              <p>The <BrandName /> Support team can provide the current information.</p>
              <Link className="primary-button" href="/support">Open Support</Link>
            </div>
          ) : null}
          {document && body ? (
            <>
              <div className="policy-document-meta">
                <span><CalendarDays /> Last updated {formatPolicyDate(document.published_at || document.updated_at, useNepali ? "ne-NP" : "en-NP")}</span>
                <span>Version {document.version}</span>
              </div>
              <PolicyBody body={body} />
              <footer>
                <strong>Need clarification?</strong>
                <p>Open a Support request and select the topic that best matches your question.</p>
                <Link href="/support">Contact khetE Support →</Link>
              </footer>
            </>
          ) : null}
        </article>
      </div>
    </main>
  );
}

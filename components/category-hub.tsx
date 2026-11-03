"use client";
/* eslint-disable @next/next/no-img-element -- Category icons are user-managed Supabase assets. */

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Layers3, Sprout } from "lucide-react";
import type { CategoryHubResponse, HubCategory } from "@/lib/category-hub";
import { ProductCard } from "@/components/product-card";

function childrenOf(categories: HubCategory[], parentId: string) {
  return categories.filter((category) => category.parentId === parentId);
}

export function CategoryHub({ rootSlug }: { rootSlug: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const activeChildSlug = searchParams.get("child");
  const activeGrandchildSlug = searchParams.get("grandchild");
  const currentPage = Number(searchParams.get("page") ?? "1") || 1;
  const [data, setData] = useState<CategoryHubResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(queryString);
    params.set("pageSize", "12");

    async function loadCategory() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/categories/${encodeURIComponent(rootSlug)}?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json() as CategoryHubResponse | { error?: string };

        if (!response.ok || !("category" in payload)) {
          throw new Error("error" in payload ? payload.error : "This category could not be loaded.");
        }

        setData(payload);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "This category could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadCategory();
    return () => controller.abort();
  }, [queryString, rootSlug]);

  const children = useMemo(
    () => data ? childrenOf(data.subcategories, data.category.id) : [],
    [data],
  );
  const activeChild = children.find((category) => category.slug === activeChildSlug);

  const updateRoute = (changes: { child?: string | null; grandchild?: string | null; page?: number | null }) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === undefined || value === "" || value === 1) params.delete(key);
      else params.set(key, String(value));
    }

    if ("child" in changes && changes.child !== activeChildSlug) params.delete("grandchild");
    if ("child" in changes || "grandchild" in changes) params.delete("page");
    const nextQuery = params.toString();
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  if (!data && loading) {
    return <main className="category-hub-page"><div className="site-container category-hub-loading"><span /><span /><span /></div></main>;
  }

  if (!data) {
    return (
      <main className="category-hub-page">
        <div className="site-container category-hub-error">
          <Sprout />
          <h1>We could not open this category</h1>
          <p>{error}</p>
          <button className="primary-button" type="button" onClick={() => window.location.reload()}>Try again</button>
        </div>
      </main>
    );
  }

  return (
    <main className="category-hub-page">
      <section className="category-hub-navigation" aria-label={`${data.category.name} subcategories`}>
        <div className="site-container">
          <div className="category-child-pills" role="list" aria-label="Child categories">
            <button
              className={!activeChildSlug && !activeGrandchildSlug ? "is-active" : ""}
              type="button"
              onClick={() => updateRoute({ child: null, grandchild: null })}
            >
              <Layers3 />
              <span>All {data.category.name}</span>
            </button>
            {children.map((child) => (
              <button
                className={activeChildSlug === child.slug ? "is-active" : ""}
                type="button"
                role="listitem"
                key={child.id}
                onClick={() => updateRoute({ child: child.slug, grandchild: null })}
              >
                {child.imageUrl ? <img src={child.imageUrl} alt="" /> : <Sprout />}
                <span>{child.name}</span>
              </button>
            ))}
          </div>

          {activeChild ? (
            <div className="category-grandchild-pills category-hub-subpills" role="list" aria-label={`${activeChild.name} categories`}>
              <button
                className={!activeGrandchildSlug ? "is-active" : ""}
                type="button"
                onClick={() => updateRoute({ grandchild: null })}
              >
                All {activeChild.name}
              </button>
              {childrenOf(data.subcategories, activeChild.id).map((grandchild) => (
                <button
                  className={activeGrandchildSlug === grandchild.slug ? "is-active" : ""}
                  type="button"
                  role="listitem"
                  key={grandchild.id}
                  onClick={() => updateRoute({ child: activeChild.slug, grandchild: grandchild.slug })}
                >
                  {grandchild.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="category-hub-results" aria-busy={loading}>
        <div className="site-container">
          <div className="category-hub-results-heading">
            <div>
              <p className="eyebrow">Available listings</p>
              <h2>{data.selectedCategory.id === data.category.id ? `All ${data.category.name}` : data.selectedCategory.name}</h2>
            </div>
            <span>{data.pagination.total} products</span>
          </div>

          {error ? <p className="category-hub-inline-error">{error}</p> : null}
          <div className={`product-grid category-hub-grid ${loading ? "is-loading" : ""}`}>
            {data.products.map((listing) => <ProductCard key={listing.id} listing={listing} spotlight={Boolean(data.pinnedSlug && listing.slug === data.pinnedSlug)} />)}
          </div>

          {!loading && !data.products.length ? (
            <div className="empty-state category-hub-empty">
              <Sprout />
              <h3>No published products are available here yet.</h3>
              <p>Try another subcategory or return to all {data.category.name} listings.</p>
              <button className="secondary-button" type="button" onClick={() => updateRoute({ child: null, grandchild: null })}>View all</button>
            </div>
          ) : null}

          {data.pagination.totalPages > 1 ? (
            <nav className="category-pagination" aria-label="Product pages">
              <button
                type="button"
                disabled={currentPage <= 1 || loading}
                onClick={() => updateRoute({ page: currentPage - 1 })}
              ><ChevronLeft /> Previous</button>
              <span>Page {data.pagination.page} of {data.pagination.totalPages}</span>
              <button
                type="button"
                disabled={currentPage >= data.pagination.totalPages || loading}
                onClick={() => updateRoute({ page: currentPage + 1 })}
              >Next <ChevronRight /></button>
            </nav>
          ) : null}
        </div>
      </section>
    </main>
  );
}

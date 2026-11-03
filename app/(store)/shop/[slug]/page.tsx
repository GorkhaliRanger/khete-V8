import { Suspense } from "react";
import { CategoryHub } from "@/components/category-hub";
import { CatalogBrowseBar } from "@/components/catalog-browse-bar";

export default async function ShopCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <>
      <Suspense fallback={null}><CatalogBrowseBar /></Suspense>
      <Suspense fallback={<main className="category-hub-page"><div className="site-container page-loading">Loading category…</div></main>}>
        <CategoryHub rootSlug={slug} />
      </Suspense>
    </>
  );
}

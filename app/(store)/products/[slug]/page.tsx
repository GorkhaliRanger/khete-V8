import { ProductDetailView } from "@/components/product-detail-view";
import { listings } from "@/data/marketplace";

export function generateStaticParams() { return listings.map((listing) => ({ slug: listing.slug })); }

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProductDetailView slug={slug} />;
}

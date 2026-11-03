/* eslint-disable @next/next/no-img-element -- Category icons are user-managed Supabase assets. */
import Link from "next/link";
import type { Category } from "@/data/marketplace";

export function CategoryCard({ category }: { category: Category }) {
  const imageUrl = category.imageUrl || `/categories/${category.icon}.png`;
  return (
    <Link className={`category-card category-${category.icon}`} href={`/shop/${category.id}`}>
      <span className="category-icon"><img src={imageUrl} alt={category.name} /></span>
      <strong>{category.name}</strong>
      <small>{category.nameNe}</small>
    </Link>
  );
}

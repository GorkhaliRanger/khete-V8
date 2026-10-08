/* eslint-disable @next/next/no-img-element -- Category icons are user-managed Supabase assets. */
import Link from "next/link";
import { Milk, Sprout, Tractor, Wheat, Wrench } from "lucide-react";
import type { Category } from "@/data/marketplace";

const icons = { tractor: Tractor, sprout: Sprout, wheat: Wheat, cow: Milk, wrench: Wrench };

export function CategoryCard({ category }: { category: Category }) {
  const Icon = icons[category.icon];
  return (
    <Link className={`category-card category-${category.icon}`} href={`/shop/${category.id}`}>
      <span className="category-icon">{category.imageUrl ? <img src={category.imageUrl} alt="" /> : <Icon />}</span>
      <span><strong>{category.name}</strong><small>{category.nameNe}</small></span>
      <p>{category.description}</p>
      <span className="category-explore">Explore category <span aria-hidden="true">→</span></span>
    </Link>
  );
}

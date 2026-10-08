"use client";

import { CategoryCard } from "./category-card";
import { useMarketplace } from "./marketplace-provider";

export function HomeCategoryGrid() {
  const { categories } = useMarketplace();
  const homepageCategories = categories.filter((category) => category.showOnHomepage !== false);
  const visible = (homepageCategories.length ? homepageCategories : categories).slice(0, 5);

  return <div className="category-grid">{visible.map((category) => <CategoryCard key={category.id} category={category} />)}</div>;
}

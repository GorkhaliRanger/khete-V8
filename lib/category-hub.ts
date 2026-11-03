import type { Listing } from "@/data/marketplace";
import type { CategoryRow } from "@/lib/categories";

export type HubCategory = {
  id: string;
  parentId: string | null;
  level: number;
  slug: string;
  name: string;
  nameNe: string;
  description: string;
  iconName: string | null;
  imageUrl: string | null;
};

export type CategoryHubResponse = {
  category: HubCategory;
  selectedCategory: HubCategory;
  subcategories: HubCategory[];
  products: Listing[];
  pinnedSlug: string | null;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export function toHubCategory(row: CategoryRow): HubCategory {
  return {
    id: row.id,
    parentId: row.parent_id,
    level: row.level,
    slug: row.slug,
    name: row.name_en,
    nameNe: row.name_ne ?? "",
    description: row.description_en ?? "Explore every available listing in this category.",
    iconName: row.icon_name,
    imageUrl: row.image_url,
  };
}

export function categoryDescendants(rows: CategoryRow[], categoryId: string) {
  const childrenByParent = new Map<string, CategoryRow[]>();

  for (const row of rows) {
    if (!row.parent_id) continue;
    const children = childrenByParent.get(row.parent_id) ?? [];
    children.push(row);
    childrenByParent.set(row.parent_id, children);
  }

  const descendants: CategoryRow[] = [];
  const queue = [...(childrenByParent.get(categoryId) ?? [])];

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    descendants.push(current);
    queue.push(...(childrenByParent.get(current.id) ?? []));
  }

  return descendants.sort((a, b) => a.sort_order - b.sort_order || a.name_en.localeCompare(b.name_en));
}

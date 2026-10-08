import type { Category } from "@/data/marketplace";

export type CategoryRow = {
  id: string;
  parent_id: string | null;
  level: number;
  slug: string;
  name_en: string;
  name_ne: string | null;
  description_en: string | null;
  description_ne: string | null;
  icon_name: string | null;
  image_url: string | null;
  banner_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  show_on_homepage: boolean;
  is_active: boolean;
  sort_order: number;
};

export const categorySelect = [
  "id",
  "parent_id",
  "level",
  "slug",
  "name_en",
  "name_ne",
  "description_en",
  "description_ne",
  "icon_name",
  "image_url",
  "banner_url",
  "seo_title",
  "seo_description",
  "show_on_homepage",
  "is_active",
  "sort_order",
].join(",");

const supportedIcons = new Set<Category["icon"]>(["tractor", "sprout", "wheat", "cow", "wrench"]);

function iconFor(value: string | null): Category["icon"] {
  return value && supportedIcons.has(value as Category["icon"])
    ? value as Category["icon"]
    : "sprout";
}

function byOrder(a: CategoryRow, b: CategoryRow) {
  return a.sort_order - b.sort_order || a.name_en.localeCompare(b.name_en);
}

export function buildCategoryTree(rows: CategoryRow[]): Category[] {
  const ordered = [...rows].sort(byOrder);
  const childrenByParent = new Map<string, CategoryRow[]>();

  for (const row of ordered) {
    if (!row.parent_id) continue;
    const children = childrenByParent.get(row.parent_id) ?? [];
    children.push(row);
    childrenByParent.set(row.parent_id, children);
  }

  return ordered.filter((row) => row.level === 0).map((parent) => ({
    id: parent.slug,
    databaseId: parent.id,
    name: parent.name_en,
    nameNe: parent.name_ne ?? "",
    description: parent.description_en ?? "Explore available agricultural listings in this category.",
    imageUrl: parent.image_url ?? undefined,
    icon: iconFor(parent.icon_name),
    showOnHomepage: parent.show_on_homepage,
    active: parent.is_active,
    children: (childrenByParent.get(parent.id) ?? []).filter((row) => row.level === 1).sort(byOrder).map((child) => ({
      id: child.slug,
      databaseId: child.id,
      name: child.name_en,
      nameNe: child.name_ne ?? undefined,
      grandchildren: (childrenByParent.get(child.id) ?? []).filter((row) => row.level === 2).sort(byOrder).map((grandchild) => ({
        id: grandchild.slug,
        databaseId: grandchild.id,
        name: grandchild.name_en,
        nameNe: grandchild.name_ne ?? undefined,
      })),
    })),
  }));
}

export function categoryLevelLabel(level: number) {
  return level === 0 ? "Parent" : level === 1 ? "Child" : "Grandchild";
}

export function categoryLevelNumber(level: "Parent" | "Child" | "Grandchild") {
  return level === "Parent" ? 0 : level === "Child" ? 1 : 2;
}

export function slugifyCategory(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

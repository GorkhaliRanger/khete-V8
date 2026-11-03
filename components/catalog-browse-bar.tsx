"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, LayoutGrid, Milk, Sprout, Tractor, Wheat, Wrench } from "lucide-react";
import { useMarketplace } from "./marketplace-provider";

const categoryIcons = {
  machinery: Tractor,
  produce: Sprout,
  "seeds-inputs": Wheat,
  livestock: Milk,
  services: Wrench,
} as const;

/* Daraz-style browse bar: a "Categories" dropdown flyout (main categories +
   subcategories) immediately followed by the breadcrumb trail. Context-aware:
   on /products and /deals the links filter the listing in place, on
   /shop/<category> they navigate between category hubs. */
export function CatalogBrowseBar() {
  const { categories } = useMarketplace();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape, and after every navigation.
  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
  const query = searchParams.toString();
  useEffect(() => setOpen(false), [pathname, query]);

  const shopMatch = pathname.match(/^\/shop\/([^/]+)/);
  const shopSlug = shopMatch?.[1] ?? null;
  const context: "products" | "deals" | "shop" | "services" = shopSlug ? "shop" : pathname === "/deals" ? "deals" : pathname === "/services" ? "services" : "products";
  const basePath = context === "deals" ? "/deals" : context === "services" ? "/services" : "/products";

  const categoryId = context === "shop" ? shopSlug : (searchParams.get("category") ?? "all");
  const childId = searchParams.get("child");
  const activeCategory = categories.find((item) => item.id === categoryId);
  const activeChild = activeCategory?.children.find((item) => item.id === childId);

  const hrefFor = (catId?: string, chId?: string) => {
    if (context === "shop") {
      if (!catId || catId === "all") return "/products";
      return chId ? `/shop/${catId}?child=${chId}` : `/shop/${catId}`;
    }
    const params = new URLSearchParams();
    if (catId && catId !== "all") params.set("category", catId);
    if (chId) params.set("child", chId);
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };

  const sectionLabel = context === "deals" ? "Deals" : context === "services" ? "Services & Rentals" : "Products";

  return (
    <div className="browse-bar">
      <div className="site-container browse-bar-inner">
        <div className="categories-menu" ref={rootRef}>
          <button
            type="button"
            className="categories-menu-button"
            aria-expanded={open}
            aria-haspopup="true"
            onClick={() => setOpen((value) => !value)}
          >
            <LayoutGrid size={16} />
            Categories
            <ChevronDown size={15} className="categories-menu-chevron" />
          </button>
          {open ? (
            <div className="categories-menu-flyout" role="menu">
              <div className="categories-menu-group">
                <Link className="categories-menu-main" href={basePath} role="menuitem">
                  <LayoutGrid size={17} />
                  <span>All categories</span>
                </Link>
              </div>
              {categories.map((category) => {
                const Icon = categoryIcons[category.icon as keyof typeof categoryIcons] ?? Sprout;
                return (
                  <div className="categories-menu-group" key={category.id}>
                    <Link className="categories-menu-main" href={hrefFor(category.id)} role="menuitem">
                      <Icon size={17} />
                      <span>{category.name}</span>
                    </Link>
                    {category.children.length ? (
                      <div className="categories-menu-children">
                        {category.children.map((child) => (
                          <Link key={child.id} href={hrefFor(category.id, child.id)} role="menuitem">
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <span className="browse-bar-divider" aria-hidden="true" />

        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <ChevronRight size={13} aria-hidden="true" />
          {activeCategory ? (
            <>
              <Link href={basePath}>{sectionLabel}</Link>
              <ChevronRight size={13} aria-hidden="true" />
              {activeChild ? (
                <>
                  <Link href={hrefFor(activeCategory.id)}>{activeCategory.name}</Link>
                  <ChevronRight size={13} aria-hidden="true" />
                  <span aria-current="page">{activeChild.name}</span>
                </>
              ) : (
                <span aria-current="page">{activeCategory.name}</span>
              )}
            </>
          ) : (
            <span aria-current="page">{sectionLabel}</span>
          )}
        </nav>
      </div>
    </div>
  );
}

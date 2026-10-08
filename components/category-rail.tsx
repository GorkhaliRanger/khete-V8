"use client";
/* eslint-disable @next/next/no-img-element -- Category icons are user-managed Supabase assets. */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Milk, Sprout, Tractor, Wheat, Wrench } from "lucide-react";
import { useMarketplace } from "./marketplace-provider";

const icons = { tractor: Tractor, sprout: Sprout, wheat: Wheat, cow: Milk, wrench: Wrench };

type RailItem = {
  id: string;
  name: string;
  secondary?: string;
  href: string;
  icon: keyof typeof icons;
  imageUrl?: string;
};

export function CategoryRail({ mode = "products" }: { mode?: "products" | "services" }) {
  const rail = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const { categories } = useMarketplace();
  const serviceCategory = categories.find((category) => category.id === "services");
  const items: RailItem[] = mode === "services"
    ? (serviceCategory?.children.flatMap((child, index) => [
        {
          id: child.id,
          name: child.name,
          secondary: `${child.grandchildren.length} specialities`,
          href: `/shop/services?child=${child.id}`,
          icon: (index % 2 === 0 ? "tractor" : "wrench") as keyof typeof icons,
        },
        ...child.grandchildren.map((grandchild) => ({
          id: grandchild.id,
          name: grandchild.name,
          secondary: child.name,
          href: `/shop/services?child=${child.id}&grandchild=${grandchild.id}`,
          icon: (index % 2 === 0 ? "tractor" : "wrench") as keyof typeof icons,
        })),
      ]) ?? [])
    : categories.map((category) => ({
        id: category.id,
        name: category.name,
        secondary: category.nameNe,
        href: `/shop/${category.id}`,
        icon: category.icon,
        imageUrl: category.imageUrl,
      }));

  const move = (direction: number) => {
    rail.current?.scrollBy({ left: direction * Math.max(260, rail.current.clientWidth * .7), behavior: "smooth" });
  };

  useEffect(() => {
    if (mode !== "products") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("categories") !== "all") return;
    const frame = window.requestAnimationFrame(() => setExpanded(true));
    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  return (
    <section className="category-rail-section" id="all-categories">
      <div className="site-container">
        <div className="category-rail-heading">
          <p className="eyebrow">{mode === "services" ? "Curated Services" : "Curated Categories"}</p>
          <h2>{mode === "services" ? "Services and rentals, organised by need." : "Browse the complete marketplace."}</h2>
          <div className="category-rail-actions">
            {!expanded ? <><button type="button" onClick={() => move(-1)} aria-label="Scroll categories left"><ArrowLeft /></button><button type="button" onClick={() => move(1)} aria-label="Scroll categories right"><ArrowRight /></button></> : null}
            <button className="secondary-button" type="button" aria-expanded={expanded} aria-controls={`${mode}-category-list`} onClick={() => setExpanded((value) => !value)}>{expanded ? "Show carousel" : "Explore all"}</button>
          </div>
        </div>
        <div className={`category-rail ${expanded ? "is-expanded" : ""}`} id={`${mode}-category-list`} ref={rail}>
          {items.map((item) => {
            const Icon = icons[item.icon];
            return (
              <Link className="category-rail-card" href={item.href} key={item.id}>
                <span className="category-rail-icon">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <Icon />}</span>
                <span><strong>{item.name}</strong>{item.secondary ? <small>{item.secondary}</small> : null}</span>
                <ArrowRight className="category-rail-arrow" />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

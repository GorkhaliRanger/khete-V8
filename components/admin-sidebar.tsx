"use client";

/* eslint-disable @next/next/no-img-element -- profile avatars are user-managed Supabase URLs. */

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  FileCheck2,
  FileText,
  FileUp,
  HandCoins,
  Headphones,
  LayoutDashboard,
  Megaphone,
  Package,
  ShoppingBag,
  Sparkles,
  Star,
  Tags,
  UserCog,
  UserRound,
  UsersRound,
} from "lucide-react";
import { ADMIN_ROLE_DETAILS, type AdminRole } from "@/lib/admin-permissions";
import { createClient } from "@/lib/supabase/client";

type AdminSection = "dashboard" | "settings" | "users" | "categories" | "listings" | "import" | "orders" | "support" | "reviews" | "certificates" | "network" | "professional-finance" | "promotions" | "homepage" | "content";

type AdminAccount = {
  email: string;
  fullName: string;
  avatarUrl: string | null;
  roles: string[];
};

const links = [
  { section: "dashboard", href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { section: "users", href: "/admin/users", label: "Admin Users", icon: UserCog, roles: ["super_admin"] },
  { section: "categories", href: "/admin/categories", label: "Categories", icon: Tags, roles: ["super_admin", "product_inventory_manager"] },
  { section: "listings", href: "/admin/listings", label: "Listings", icon: Package, roles: ["super_admin", "product_inventory_manager"] },
  { section: "import", href: "/admin/import", label: "Bulk import", icon: FileUp, roles: ["super_admin", "product_inventory_manager"] },
  { section: "orders", href: "/admin/orders", label: "Orders", icon: ShoppingBag, roles: ["super_admin", "order_delivery_manager", "customer_support", "finance_manager"] },
  { section: "support", href: "/admin/support", label: "Support", icon: Headphones, roles: ["super_admin", "customer_support", "order_delivery_manager"] },
  { section: "reviews", href: "/admin/reviews", label: "Reviews", icon: Star, roles: ["super_admin", "product_inventory_manager", "customer_support", "content_promotion_manager"] },
  { section: "certificates", href: "/admin/certificates", label: "Certificates", icon: FileCheck2, roles: ["super_admin", "product_inventory_manager", "customer_support", "content_promotion_manager"] },
  { section: "network", href: "/admin/network", label: "Professional Network", icon: UsersRound, roles: ["super_admin", "content_promotion_manager", "customer_support"] },
  { section: "professional-finance", href: "/admin/professional-finance", label: "Professional Finance", icon: HandCoins, roles: ["super_admin", "finance_manager", "order_delivery_manager"] },
  { section: "promotions", href: "/admin/promotions", label: "Promotions", icon: Megaphone, roles: ["super_admin", "content_promotion_manager"] },
  { section: "homepage", href: "/admin/homepage", label: "Homepage Highlights", icon: Sparkles, roles: ["super_admin", "content_promotion_manager", "product_inventory_manager"] },
  { section: "content", href: "/admin/content", label: "Policies & Content", icon: FileText, roles: ["super_admin", "content_promotion_manager"] },
] as const;

function roleLabel(role: string) {
  return ADMIN_ROLE_DETAILS[role as AdminRole]?.label ?? role.replaceAll("_", " ");
}

export function AdminSidebar({ active, roles }: { active: AdminSection; roles?: readonly string[] }) {
  const [account, setAccount] = useState<AdminAccount | null>(null);
  const [accountRoles, setAccountRoles] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadAccount() {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!mounted || !authData.user) return;

      const [profileResult, roleResult] = await Promise.all([
        supabase.from("profiles").select("full_name,avatar_url").eq("id", authData.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", authData.user.id),
      ]);
      if (!mounted) return;

      const detectedRoles = (roleResult.data ?? []).map((row) => String(row.role));
      setAccountRoles(detectedRoles);
      setAccount({
        email: authData.user.email ?? "",
        fullName: String(profileResult.data?.full_name || authData.user.user_metadata?.full_name || "Administrator"),
        avatarUrl: profileResult.data?.avatar_url ? String(profileResult.data.avatar_url) : null,
        roles: detectedRoles,
      });
    }

    void loadAccount();
    window.addEventListener("khete-admin-profile-updated", loadAccount);
    return () => {
      mounted = false;
      window.removeEventListener("khete-admin-profile-updated", loadAccount);
    };
  }, []);

  const effectiveRoles = roles?.length ? [...roles] : accountRoles;
  const visibleLinks = links.filter((item) => !("roles" in item) || item.roles.some((role) => effectiveRoles.includes(role)));
  const primaryRole = account?.roles.includes("super_admin")
    ? "super_admin"
    : account?.roles.find((role) => role !== "customer");
  const initials = account?.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";

  return <>
    <aside className="admin-sidebar">
      <Link className="admin-brand" href="/admin">
        <span><Image src="/khete-logo.png" alt="khetE" width={204} height={50} /></span>
        <small>Administration</small>
      </Link>
      <nav>{visibleLinks.map((item) => { const Icon = item.icon; return <Link className={active === item.section ? "active" : ""} href={item.href} key={`${item.section}-${item.label}`}><Icon /> {item.label}</Link>; })}</nav>
    </aside>

    <header className="admin-session-header">
      <Link className={`admin-account-card ${active === "settings" ? "active" : ""}`} href="/admin/settings" aria-label="Open Admin profile settings" title="Open Admin profile settings">
        <span className="admin-account-avatar">
          {account?.avatarUrl ? <img src={account.avatarUrl} alt="" /> : account ? initials : <UserRound />}
        </span>
        <span className="admin-account-summary">
          <strong>{account?.fullName ?? "Loading profile…"}</strong>
          <small>{account?.email ?? "Checking account"}</small>
        </span>
        {primaryRole ? <span className="admin-account-role">{roleLabel(primaryRole)}</span> : null}
      </Link>
    </header>
  </>;
}

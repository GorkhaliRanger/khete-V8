import Link from "next/link";
import Image from "next/image";
import { FileCheck2, FileText, FileUp, HandCoins, Headphones, LayoutDashboard, Megaphone, Package, ShoppingBag, Sparkles, Star, Tags, UserCog, UsersRound } from "lucide-react";
type AdminSection = "dashboard" | "users" | "categories" | "listings" | "import" | "orders" | "support" | "reviews" | "certificates" | "network" | "professional-finance" | "promotions" | "homepage" | "content";

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

export function AdminSidebar({ active, roles }: { active: AdminSection; roles?: readonly string[] }) {
  const visibleLinks = roles
    ? links.filter((item) => !("roles" in item) || item.roles.some((role) => roles.includes(role)))
    : links;
  return (
    <aside className="admin-sidebar">
      <Link className="admin-brand" href="/admin">
        <span><Image src="/khete-logo.png" alt="khetE" width={204} height={50} /></span>
        <small>Administration</small>
      </Link>
      <nav>{visibleLinks.map((item) => { const Icon = item.icon; return <Link className={active === item.section ? "active" : ""} href={item.href} key={`${item.section}-${item.label}`}><Icon /> {item.label}</Link>; })}</nav>
    </aside>
  );
}

"use client";

/* eslint-disable @next/next/no-img-element -- profile avatars are user-managed Supabase URLs. */

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import {
  ClipboardList,
  FileCheck2,
  FileText,
  FileUp,
  HandCoins,
  Headphones,
  LayoutDashboard,
  LoaderCircle,
  LogIn,
  LogOut,
  Megaphone,
  Package,
  ShoppingBag,
  Settings,
  Sparkles,
  Star,
  Tags,
  UserCog,
  UserRound,
  UsersRound,
} from "lucide-react";
import { adminSettingsReturnPath } from "@/lib/admin-settings-navigation";
import { adminRoleCaption, adminRoleLabels } from "@/lib/admin-permissions";
import { createClient } from "@/lib/supabase/admin-client";
import { useAdminProfilePhoto } from "@/components/use-admin-profile-photo";

type AdminSection = "dashboard" | "settings" | "users" | "activity" | "categories" | "listings" | "import" | "orders" | "support" | "reviews" | "certificates" | "network" | "professional-finance" | "promotions" | "homepage" | "content";

type AdminAccount = {
  id: string;
  email: string;
  fullName: string;
};

const links = [
  { section: "dashboard", href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { section: "users", href: "/admin/users", label: "Admin Users", icon: UserCog, roles: ["super_admin"] },
  { section: "activity", href: "/admin/activity", label: "Admin Activity", icon: ClipboardList, roles: ["super_admin"] },
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
  const router = useRouter();
  const [account, setAccount] = useState<AdminAccount | null>(null);
  const [accountRoles, setAccountRoles] = useState<string[]>([]);
  const { photo } = useAdminProfilePhoto(account?.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [menuError, setMenuError] = useState("");
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const focusMenuOnOpen = useRef(false);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelHoverClose() {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    hoverCloseTimer.current = null;
  }

  function openAccountMenu(focus = false) {
    cancelHoverClose();
    focusMenuOnOpen.current = focus;
    setMenuError("");
    setMenuOpen(true);
    if (focus) menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }

  function scheduleHoverClose() {
    cancelHoverClose();
    hoverCloseTimer.current = setTimeout(() => {
      if (!triggerRef.current?.contains(document.activeElement) && !leaving) setMenuOpen(false);
    }, 180);
  }

  useEffect(() => () => {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    if (focusMenuOnOpen.current) menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    focusMenuOnOpen.current = false;

    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !triggerRef.current?.contains(event.target)) setMenuOpen(false);
    }
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      avatarRef.current?.focus();
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    let mounted = true;

    async function loadAccount() {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!mounted || !authData.user) return;

      const [profileResult, roleResult] = await Promise.all([
        supabase.from("admin_profiles").select("full_name").eq("user_id", authData.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", authData.user.id),
      ]);
      if (!mounted) return;

      const detectedRoles = (roleResult.data ?? []).map((row) => String(row.role));
      setAccountRoles(detectedRoles);
      setAccount({
        id: authData.user.id,
        email: authData.user.email ?? "",
        fullName: String(profileResult.data?.full_name || "Administrator"),
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
  const accountRoleLabel = adminRoleCaption(effectiveRoles);
  const accountRoleDetails = adminRoleLabels(effectiveRoles).join(" • ") || "Administrator";
  const visibleLinks = links.filter((item) => !("roles" in item) || item.roles.some((role) => effectiveRoles.includes(role)));

  function openSettings() {
    setMenuOpen(false);
    if (active === "settings") return;
    const currentPage = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const returnTo = adminSettingsReturnPath(currentPage, window.location.origin);
    router.push(`/admin/settings?returnTo=${encodeURIComponent(returnTo)}`);
  }

  async function leaveAdmin(mode: "login" | "logout") {
    setLeaving(true);
    setMenuError("");
    try {
      // Only the Admin session is ended. The customer session has its own client.
      const { error: signOutError } = await createClient().auth.signOut({ scope: "local" });
      if (signOutError) throw signOutError;
      const currentPage = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const returnTo = adminSettingsReturnPath(currentPage, window.location.origin);
      setMenuOpen(false);
      router.replace(mode === "login"
        ? `/admin/login?switch=1&next=${encodeURIComponent(returnTo)}`
        : "/admin/login");
      router.refresh();
    } catch {
      setMenuError("Admin sign-out could not be completed. Please try again.");
      setLeaving(false);
    }
  }

  function navigateMenu(event: KeyboardEvent<HTMLDivElement>) {
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    if (!items.length) return;
    const currentIndex = items.findIndex((item) => item === document.activeElement);
    const destination = event.key === "Home" ? 0
      : event.key === "End" ? items.length - 1
        : event.key === "ArrowDown" ? (currentIndex + 1) % items.length
          : event.key === "ArrowUp" ? (currentIndex - 1 + items.length) % items.length
            : null;
    if (destination === null) return;
    event.preventDefault();
    items[destination]?.focus();
  }

  return <>
    <aside className="admin-sidebar">
      <Link className="admin-brand" href="/admin">
        <span><Image src="/khete-logo.png" alt="khetE" width={204} height={50} /></span>
        <small>Administration</small>
      </Link>
      <nav>{visibleLinks.map((item) => { const Icon = item.icon; return <Link className={active === item.section ? "active" : ""} href={item.href} key={`${item.section}-${item.label}`}><Icon /> {item.label}</Link>; })}</nav>
    </aside>

    <header className="admin-session-header">
      <span className="admin-session-title">Admin Panel</span>
      <div
        className="admin-profile-trigger"
        ref={triggerRef}
        onPointerEnter={(event) => { if (event.pointerType === "mouse" || event.pointerType === "pen") openAccountMenu(); }}
        onPointerLeave={scheduleHoverClose}
        onBlur={(event) => { if (!triggerRef.current?.contains(event.relatedTarget as Node | null)) setMenuOpen(false); }}
      >
        <button
          ref={avatarRef}
          className="icon-button account-button signed-in admin-profile-button"
          type="button"
          onClick={() => openAccountMenu(true)}
          onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); openAccountMenu(true); } }}
          aria-label={`Open Admin account menu for ${account?.fullName ?? "administrator"}, ${accountRoleDetails}`}
          title={account?.email || "Your Admin account"}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
        >
          {photo ? <img className="account-avatar-img" src={photo} alt="" /> : <UserRound aria-hidden="true" />}
          <span className="account-status-dot" aria-hidden="true" />
        </button>
        <span className="admin-profile-role-label" title={accountRoleDetails}>{accountRoleLabel}</span>
        {menuOpen ? <div
          ref={menuRef}
          id={menuId}
          className="admin-profile-menu"
          role="menu"
          aria-label="Admin account options"
          onKeyDown={navigateMenu}
        >
          <div className="admin-profile-menu-identity" role="presentation"><strong>{account?.fullName || "Administrator"}</strong><small>{account?.email}</small><span>{accountRoleDetails}</span></div>
          <button type="button" role="menuitem" onClick={openSettings} disabled={leaving}><Settings /><span><strong>Profile & settings</strong><small>Manage this Admin profile</small></span></button>
          <button type="button" role="menuitem" onClick={() => void leaveAdmin("login")} disabled={leaving}><LogIn /><span><strong>Sign in to another admin account</strong><small>Use a different administrator profile</small></span></button>
          <button className="admin-profile-menu-logout" type="button" role="menuitem" onClick={() => void leaveAdmin("logout")} disabled={leaving}>{leaving ? <LoaderCircle className="admin-spinner" /> : <LogOut />}<span><strong>{leaving ? "Please wait…" : "Log out of Admin"}</strong></span></button>
          {menuError ? <p role="alert">{menuError}</p> : null}
        </div> : null}
      </div>
    </header>
  </>;
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Boxes,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  HandCoins,
  Headphones,
  LoaderCircle,
  Package,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Star,
  WalletCards,
  UsersRound,
} from "lucide-react";
import { AdminAccessCard, type AdminAccessState } from "@/components/admin-access-card";
import { AdminSidebar } from "@/components/admin-sidebar";
import { formatNpr } from "@/data/marketplace";
import { isOverduePendingOrder, isPendingOrder, type OrderStatus } from "@/lib/orders";
import { createClient } from "@/lib/supabase/client";

const adminRoles = new Set([
  "super_admin",
  "product_inventory_manager",
  "order_delivery_manager",
  "customer_support",
  "finance_manager",
  "content_promotion_manager",
]);

type DashboardData = {
  listings: number;
  publishedListings: number;
  lowStock: number;
  orders: number;
  openOrders: number;
  pendingOrders: number;
  overduePendingOrders: number;
  grossOrderValue: number;
  paidRevenue: number;
  pendingCollection: number;
  refundedOrderValue: number;
  partialRefundOrders: number;
  professionalGross: number;
  platformCommission: number;
  professionalPaid: number;
  openSupport: number;
  pendingReviews: number;
  pendingApplications: number;
  activeProfessionals: number;
  pendingPayout: number;
  publicCertificates: number;
  recentOrders: Array<{ id: string; order_number: string; customer_name: string; status: string; total: number; placed_at: string }>;
  recentSupport: Array<{ id: string; ticket_number: string; subject: string; status: string; priority: string; last_message_at: string }>;
};

const emptyDashboard: DashboardData = {
  listings: 0,
  publishedListings: 0,
  lowStock: 0,
  orders: 0,
  openOrders: 0,
  pendingOrders: 0,
  overduePendingOrders: 0,
  grossOrderValue: 0,
  paidRevenue: 0,
  pendingCollection: 0,
  refundedOrderValue: 0,
  partialRefundOrders: 0,
  professionalGross: 0,
  platformCommission: 0,
  professionalPaid: 0,
  openSupport: 0,
  pendingReviews: 0,
  pendingApplications: 0,
  activeProfessionals: 0,
  pendingPayout: 0,
  publicCertificates: 0,
  recentOrders: [],
  recentSupport: [],
};

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-NP", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function readable(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AdminPage() {
  const [access, setAccess] = useState<AdminAccessState>("loading");
  const [accountEmail, setAccountEmail] = useState("");
  const [detectedRoles, setDetectedRoles] = useState<string[]>([]);
  const [currentOrigin, setCurrentOrigin] = useState("");
  const [data, setData] = useState<DashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState<string[]>([]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const unavailableSections: string[] = [];

    const safe = async <T,>(label: string, request: PromiseLike<{ data: T | null; error: { message: string } | null; count?: number | null }>) => {
      const result = await request;
      if (result.error) {
        unavailableSections.push(label);
        return { data: null, count: 0 };
      }
      return { data: result.data, count: result.count ?? 0 };
    };

    try {
      const [
        listings,
        publishedListings,
        inventory,
        orders,
        openOrders,
        orderFinance,
        support,
        reviews,
        applications,
        professionals,
        professionalFinance,
        certificates,
        recentOrders,
        recentSupport,
      ] = await Promise.all([
        safe("Listings", supabase.from("listings").select("id", { count: "exact", head: true })),
        safe("Published listings", supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "published")),
        safe("Inventory", supabase.from("inventory").select("quantity,reserved_quantity,low_stock_threshold")),
        safe("Orders", supabase.from("orders").select("id", { count: "exact", head: true })),
        safe("Open orders", supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["pending_payment", "confirmed", "processing", "ready_for_dispatch", "shipped", "out_for_delivery"])),
        safe("Order finance", supabase.from("orders").select("total,status,payment_status,placed_at")),
        safe("Support", supabase.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress", "awaiting_customer"])),
        safe("Reviews", supabase.from("marketplace_reviews").select("id", { count: "exact", head: true }).in("status", ["pending", "changes_requested"])),
        safe("Applications", supabase.from("professional_applications").select("id", { count: "exact", head: true }).in("status", ["submitted", "under_review", "changes_requested"])),
        safe("Professional profiles", supabase.from("professional_profiles").select("id", { count: "exact", head: true }).eq("status", "active")),
        safe("Professional finance", supabase.from("professional_earnings").select("gross_amount,platform_commission,net_amount,activity_status,earning_status")),
        safe("Certificates", supabase.from("certificates").select("id", { count: "exact", head: true }).eq("is_public", true)),
        safe("Recent orders", supabase.from("orders").select("id,order_number,customer_name,status,total,placed_at").order("placed_at", { ascending: false }).limit(5)),
        safe("Recent support", supabase.from("support_tickets").select("id,ticket_number,subject,status,priority,last_message_at").order("last_message_at", { ascending: false }).limit(5)),
      ]);

      const inventoryRows = (inventory.data ?? []) as Array<{ quantity: number; reserved_quantity: number; low_stock_threshold: number }>;
      const orderFinanceRows = (orderFinance.data ?? []) as Array<{ total: number; status: string; payment_status: string; placed_at: string }>;
      const professionalFinanceRows = (professionalFinance.data ?? []) as Array<{
        gross_amount: number;
        platform_commission: number;
        net_amount: number;
        activity_status: string;
        earning_status: string;
      }>;
      const activeOrderRows = orderFinanceRows.filter((item) => item.status !== "cancelled");
      const pendingOrderRows = orderFinanceRows.filter((item) => isPendingOrder(item.status as OrderStatus));
      const activeProfessionalRows = professionalFinanceRows.filter(
        (item) => !["cancelled", "refunded"].includes(item.activity_status) && item.earning_status !== "reversed",
      );
      setData({
        listings: listings.count,
        publishedListings: publishedListings.count,
        lowStock: inventoryRows.filter((item) => Number(item.quantity) - Number(item.reserved_quantity) <= Number(item.low_stock_threshold)).length,
        orders: orders.count,
        openOrders: openOrders.count,
        pendingOrders: pendingOrderRows.length,
        overduePendingOrders: pendingOrderRows.filter((item) => isOverduePendingOrder(item.placed_at)).length,
        grossOrderValue: activeOrderRows.reduce((sum, item) => sum + Number(item.total), 0),
        paidRevenue: activeOrderRows.filter((item) => item.payment_status === "paid").reduce((sum, item) => sum + Number(item.total), 0),
        pendingCollection: activeOrderRows.filter((item) => ["unpaid", "pending"].includes(item.payment_status)).reduce((sum, item) => sum + Number(item.total), 0),
        refundedOrderValue: orderFinanceRows.filter((item) => item.payment_status === "refunded").reduce((sum, item) => sum + Number(item.total), 0),
        partialRefundOrders: orderFinanceRows.filter((item) => item.payment_status === "partially_refunded").length,
        professionalGross: activeProfessionalRows.reduce((sum, item) => sum + Number(item.gross_amount), 0),
        platformCommission: activeProfessionalRows.reduce((sum, item) => sum + Number(item.platform_commission), 0),
        professionalPaid: activeProfessionalRows.filter((item) => item.earning_status === "paid").reduce((sum, item) => sum + Number(item.net_amount), 0),
        openSupport: support.count,
        pendingReviews: reviews.count,
        pendingApplications: applications.count,
        activeProfessionals: professionals.count,
        pendingPayout: activeProfessionalRows.filter((item) => ["pending", "available", "scheduled"].includes(item.earning_status)).reduce((sum, item) => sum + Number(item.net_amount), 0),
        publicCertificates: certificates.count,
        recentOrders: (recentOrders.data ?? []) as DashboardData["recentOrders"],
        recentSupport: (recentSupport.data ?? []) as DashboardData["recentSupport"],
      });
      setUnavailable([...new Set(unavailableSections)]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The dashboard could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const checkAccess = async () => {
      try {
        setCurrentOrigin(window.location.origin);
        const supabase = createClient();
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) {
          if (mounted) setAccess("signed-out");
          return;
        }
        setAccountEmail(authData.user.email ?? "");
        const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", authData.user.id);
        if (roleError) throw roleError;
        const names = (roles ?? []).map((item) => item.role);
        setDetectedRoles(names);
        if (!names.some((role) => adminRoles.has(role))) {
          if (mounted) setAccess("denied");
          return;
        }
        if (!mounted) return;
        setAccess("allowed");
        await loadDashboard();
      } catch (caught) {
        if (!mounted) return;
        setError(caught instanceof Error ? caught.message : "Admin access could not be checked.");
        setAccess("error");
      }
    };
    void checkAccess();
    return () => { mounted = false; };
  }, [loadDashboard]);

  const attentionCount = useMemo(
    () => data.overduePendingOrders + data.lowStock + data.openSupport + data.pendingReviews + data.pendingApplications,
    [data],
  );

  if (access !== "allowed") {
    return <AdminAccessCard access={access} email={accountEmail} roles={detectedRoles} origin={currentOrigin} resource="the admin dashboard" error={error} requirement="an active khetE administration role" returnTo="/admin" />;
  }

  return (
    <main className="admin-shell admin-dashboard-page">
      <AdminSidebar active="dashboard" />
      <section className="admin-main">
        <header className="admin-page-heading admin-dashboard-heading">
          <div><p className="eyebrow">Marketplace control centre</p><h1>Dashboard</h1></div>
          <button type="button" onClick={() => void loadDashboard()} disabled={loading}>{loading ? <LoaderCircle className="admin-spinner" /> : <RefreshCw />} Refresh dashboard</button>
        </header>

        {error ? <p className="admin-notice admin-error-notice">{error}</p> : null}
        {unavailable.length ? <p className="admin-dashboard-warning"><AlertTriangle /> Some modules are unavailable: {unavailable.join(", ")}. Confirm their Supabase migrations have been installed.</p> : null}

        <section className="admin-dashboard-hero">
          <div
            className={`admin-dashboard-attention ${attentionCount > 0 ? "admin-dashboard-attention-alert" : "admin-dashboard-attention-clear"}`}
            role="status"
            aria-live="polite"
          >
            <div className="admin-dashboard-attention-label">
              {attentionCount > 0 ? <AlertTriangle aria-hidden="true" /> : <BadgeCheck aria-hidden="true" />}
              <span>{attentionCount > 0 ? "Needs attention" : "All clear"}</span>
            </div>
            <strong>{attentionCount}</strong>
            <p>
              {attentionCount > 0
                ? `${data.overduePendingOrders ? `${data.overduePendingOrders} order${data.overduePendingOrders === 1 ? " is" : "s are"} overdue processing, plus ` : ""}low-stock records, support requests, reviews or professional applications require action.`
                : "There are no open operational items requiring action right now."}
            </p>
          </div>
          <div className="admin-dashboard-hero-metrics">
            <article><CircleDollarSign /><span><small>Paid order value</small><strong>{formatNpr(data.paidRevenue)}</strong></span></article>
            <article><Banknote /><span><small>Pending professional payout</small><strong>{formatNpr(data.pendingPayout)}</strong></span></article>
          </div>
        </section>

        <section className="admin-dashboard-kpis">
          <Link href="/admin/orders"><ShoppingBag /><span><small>All orders</small><strong>{data.orders}</strong><em>{data.openOrders} open</em></span><ChevronRight /></Link>
          <Link className={data.overduePendingOrders > 0 ? "admin-dashboard-kpi-alert" : ""} href="/admin/orders?view=pending"><Clock3 /><span><small>Pending orders</small><strong>{data.pendingOrders}</strong><em>{data.overduePendingOrders > 0 ? `${data.overduePendingOrders} overdue — needs attention` : "Awaiting processing"}</em></span><ChevronRight /></Link>
          <Link href="/admin/listings"><Package /><span><small>Listings</small><strong>{data.listings}</strong><em>{data.publishedListings} published</em></span><ChevronRight /></Link>
          <Link className={data.lowStock > 0 ? "admin-dashboard-kpi-alert" : ""} href="/admin/listings?focus=lowstock"><Boxes /><span><small>Low stock</small><strong>{data.lowStock}</strong><em>{data.lowStock > 0 ? "Needs review" : "Stock levels healthy"}</em></span><ChevronRight /></Link>
          <Link className={data.openSupport > 0 ? "admin-dashboard-kpi-alert" : ""} href="/admin/support"><Headphones /><span><small>Support</small><strong>{data.openSupport}</strong><em>{data.openSupport > 0 ? "Open work" : "No open requests"}</em></span><ChevronRight /></Link>
          <Link className={data.pendingReviews > 0 ? "admin-dashboard-kpi-alert" : ""} href="/admin/reviews"><Star /><span><small>Reviews</small><strong>{data.pendingReviews}</strong><em>{data.pendingReviews > 0 ? "Awaiting moderation" : "No pending reviews"}</em></span><ChevronRight /></Link>
          <Link className={data.pendingApplications > 0 ? "admin-dashboard-kpi-alert" : ""} href="/admin/network"><UsersRound /><span><small>Applications</small><strong>{data.pendingApplications}</strong><em>{data.pendingApplications > 0 ? "Needs review" : `${data.activeProfessionals} active profiles`}</em></span><ChevronRight /></Link>
          <Link href="/admin/certificates"><FileCheck2 /><span><small>Certificates</small><strong>{data.publicCertificates}</strong><em>Published publicly</em></span><ChevronRight /></Link>
          <Link href="/admin/professional-finance"><BadgeCheck /><span><small>Professional network</small><strong>{data.activeProfessionals}</strong><em>Active accounts</em></span><ChevronRight /></Link>
        </section>

        <section className="admin-dashboard-finance">
          <header>
            <div>
              <WalletCards />
              <span>
                <p className="eyebrow">Financial overview</p>
                <h2>Marketplace and professional finance</h2>
                <small>Live totals from orders and the professional earnings ledger.</small>
              </span>
            </div>
            <nav>
              <Link href="/admin/orders">Order payments <ChevronRight /></Link>
              <Link href="/admin/professional-finance">Professional finance <ChevronRight /></Link>
            </nav>
          </header>
          <div className="admin-dashboard-finance-groups">
            <article>
              <h3>Marketplace orders</h3>
              <div>
                <span><small>Gross order value</small><strong>{formatNpr(data.grossOrderValue)}</strong><em>Excludes cancelled orders</em></span>
                <span><small>Payments received</small><strong>{formatNpr(data.paidRevenue)}</strong><em>Fully paid orders</em></span>
                <span><small>Pending collection</small><strong>{formatNpr(data.pendingCollection)}</strong><em>Unpaid and pending payments</em></span>
                <span><small>Refunded order value</small><strong>{formatNpr(data.refundedOrderValue)}</strong><em>{data.partialRefundOrders} partially refunded order{data.partialRefundOrders === 1 ? "" : "s"} tracked separately</em></span>
              </div>
            </article>
            <article>
              <h3>Professional services and partners</h3>
              <div>
                <span><small>Gross activity value</small><strong>{formatNpr(data.professionalGross)}</strong><em>Active, non-reversed records</em></span>
                <span><small>khetE commission</small><strong>{formatNpr(data.platformCommission)}</strong><em>Recorded platform commission</em></span>
                <span><small>Pending payouts</small><strong>{formatNpr(data.pendingPayout)}</strong><em>Pending, available or scheduled</em></span>
                <span><small>Payouts completed</small><strong>{formatNpr(data.professionalPaid)}</strong><em>Net amount marked paid</em></span>
              </div>
            </article>
          </div>
          <footer><RotateCcw /><span>Exact partial-refund amounts will appear after the future payment/refund ledger is connected. Until then, partially refunded orders are counted without estimating their value.</span><HandCoins /></footer>
        </section>

        <section className="admin-dashboard-streams">
          <article>
            <header><div><ShoppingBag /><span><h2>Recent orders</h2><p>Latest marketplace activity</p></span></div><Link href="/admin/orders">View all <ChevronRight /></Link></header>
            <div className="admin-dashboard-list">
              {data.recentOrders.length ? data.recentOrders.map((order) => (
                <Link href="/admin/orders" key={order.id}><span><strong>{order.order_number}</strong><small>{order.customer_name} · {shortDate(order.placed_at)}</small></span><span><b>{formatNpr(Number(order.total))}</b><em>{readable(order.status)}</em></span></Link>
              )) : <div className="admin-dashboard-empty"><ShoppingBag /><span>No orders yet</span></div>}
            </div>
          </article>
          <article>
            <header><div><Headphones /><span><h2>Support queue</h2><p>Recent customer conversations</p></span></div><Link href="/admin/support">View all <ChevronRight /></Link></header>
            <div className="admin-dashboard-list">
              {data.recentSupport.length ? data.recentSupport.map((ticket) => (
                <Link href="/admin/support" key={ticket.id}><span><strong>{ticket.ticket_number}</strong><small>{ticket.subject} · {shortDate(ticket.last_message_at)}</small></span><span><b className={`dashboard-priority-${ticket.priority}`}>{readable(ticket.priority)}</b><em>{readable(ticket.status)}</em></span></Link>
              )) : <div className="admin-dashboard-empty"><Headphones /><span>No support requests yet</span></div>}
            </div>
          </article>
        </section>

        <section className="admin-dashboard-shortcuts">
          <div><Clock3 /><span><h2>Quick actions</h2><p>Open the most frequently used administration workspaces.</p></span></div>
          <nav><Link href="/admin/listings">Add or edit listing</Link><Link href="/admin/promotions">Manage promotions</Link><Link href="/admin/content">Update policies</Link><Link href="/admin/certificates">Manage certificates</Link></nav>
        </section>
      </section>
    </main>
  );
}

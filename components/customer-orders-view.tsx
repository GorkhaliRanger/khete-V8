"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  FileText,
  LoaderCircle,
  PackageCheck,
  Search,
  ShoppingBag,
  Truck,
  UserRound,
} from "lucide-react";
import { formatNpr } from "@/data/marketplace";
import {
  formatOrderDate,
  labelOrderStatus,
  labelPaymentStatus,
  orderDocumentSelect,
  orderError,
  orderItemSelect,
  orderSelect,
  orderStatuses,
  type OrderDocumentRow,
  type OrderItemRow,
  type OrderRow,
  type OrderStatus,
  type OrderWithItems,
} from "@/lib/orders";
import { createClient } from "@/lib/supabase/client";
import { useMarketplace } from "./marketplace-provider";

const finishedStatuses = new Set<OrderStatus>(["delivered", "cancelled", "returned", "refunded"]);

export function CustomerOrdersView({ documentFocus = false }: { documentFocus?: boolean }) {
  const { user, authReady, openLogin } = useMarketplace();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [documents, setDocuments] = useState<OrderDocumentRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | OrderStatus>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setDocuments([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: orderData, error: orderLoadError } = await supabase
        .from("orders")
        .select(orderSelect)
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });
      if (orderLoadError) throw orderLoadError;

      const rows = (orderData ?? []) as unknown as OrderRow[];
      const ids = rows.map((order) => order.id);
      let itemRows: OrderItemRow[] = [];
      let documentRows: OrderDocumentRow[] = [];
      if (ids.length) {
        const [{ data: itemData, error: itemError }, { data: documentData, error: documentError }] = await Promise.all([
          supabase.from("order_items").select(orderItemSelect).in("order_id", ids).order("created_at"),
          supabase.from("order_documents").select(orderDocumentSelect).in("order_id", ids).eq("status", "issued").order("issued_at", { ascending: false }),
        ]);
        if (itemError) throw itemError;
        if (documentError) throw documentError;
        itemRows = (itemData ?? []) as unknown as OrderItemRow[];
        documentRows = (documentData ?? []) as unknown as OrderDocumentRow[];
      }
      setOrders(rows.map((order) => ({
        ...order,
        items: itemRows.filter((item) => item.order_id === order.id),
      })));
      setDocuments(documentRows);
    } catch (caught) {
      setError(orderError(caught));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authReady) return;
    queueMicrotask(() => void loadOrders());
  }, [authReady, loadOrders]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (status !== "all" && order.status !== status) return false;
      if (documentFocus && !documents.some((document) => document.order_id === order.id)) return false;
      if (!needle) return true;
      return [
        order.order_number,
        order.customer_name,
        order.district,
        order.tracking_reference ?? "",
        ...order.items.flatMap((item) => [item.listing_name, item.variant_name ?? ""]),
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [documentFocus, documents, orders, query, status]);

  if (!authReady) {
    return <main className="simple-page"><div className="site-container account-loading">Loading your order centre…</div></main>;
  }

  if (!user) {
    return (
      <main className="simple-page">
        <div className="site-container empty-state account-guest">
          <UserRound />
          <h1>Log in to view your orders.</h1>
          <p>Order tracking, confirmations, invoices and delivery updates are private to your account.</p>
          <button className="primary-button" type="button" onClick={openLogin}>Login or register</button>
        </div>
      </main>
    );
  }

  const activeCount = orders.filter((order) => !finishedStatuses.has(order.status)).length;
  const deliveredCount = orders.filter((order) => order.status === "delivered").length;

  return (
    <main className="customer-orders-page">
      <div className="site-container">
        <header className="customer-orders-hero">
          <div>
            <p className="eyebrow">{documentFocus ? "Invoices and confirmations" : "Customer order centre"}</p>
            <h1>{documentFocus ? "My order documents" : "Orders, delivery and tracking"}</h1>
            <p>{documentFocus
              ? "Open printable confirmations and invoices that khetE has issued for your orders."
              : "Follow every order from submission through fulfilment, dispatch and delivery."}</p>
          </div>
          <Link className="secondary-button" href="/account">Back to account</Link>
        </header>

        <section className="customer-order-stats" aria-label="Order summary">
          <article><ShoppingBag /><span><small>Total orders</small><strong>{orders.length}</strong></span></article>
          <article><Truck /><span><small>Active orders</small><strong>{activeCount}</strong></span></article>
          <article><PackageCheck /><span><small>Delivered</small><strong>{deliveredCount}</strong></span></article>
          <article><FileText /><span><small>Issued documents</small><strong>{documents.length}</strong></span></article>
        </section>

        <section className="customer-order-toolbar">
          <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Order, product or tracking reference…" /></label>
          <select value={status} onChange={(event) => setStatus(event.target.value as "all" | OrderStatus)} aria-label="Filter orders by status">
            <option value="all">All order statuses</option>
            {orderStatuses.map((item) => <option key={item} value={item}>{labelOrderStatus(item)}</option>)}
          </select>
          {documentFocus ? <Link href="/account/orders">Show all orders</Link> : <Link href="/account/orders?view=documents">Only orders with documents</Link>}
        </section>

        {loading ? <div className="customer-orders-state"><LoaderCircle className="admin-spinner" /> Loading your orders…</div> : null}
        {error ? <div className="customer-orders-state error">{error}</div> : null}
        {!loading && !error && !filtered.length ? (
          <div className="customer-orders-state empty">
            <ShoppingBag />
            <div><strong>{orders.length ? "No orders match this view" : "No orders yet"}</strong><p>{orders.length ? "Change the search or status filter." : "Submitted marketplace orders will appear here."}</p></div>
          </div>
        ) : null}

        <div className="customer-order-grid">
          {filtered.map((order) => {
            const orderDocuments = documents.filter((document) => document.order_id === order.id);
            return (
              <article className="customer-order-summary-card" key={order.id}>
                <header>
                  <div><strong>{order.order_number}</strong><span>{formatOrderDate(order.placed_at)}</span></div>
                  <span className={`order-status order-status-${order.status}`}>{labelOrderStatus(order.status)}</span>
                </header>
                <div className="customer-order-summary-items">
                  {order.items.slice(0, 3).map((item) => (
                    <span key={item.id}><b>{item.listing_name}{item.variant_name ? ` — ${item.variant_name}` : ""}</b><small>{Number(item.quantity)} × {formatNpr(Number(item.unit_price))}</small></span>
                  ))}
                  {order.items.length > 3 ? <em>+{order.items.length - 3} more item{order.items.length - 3 === 1 ? "" : "s"}</em> : null}
                </div>
                <div className="customer-order-summary-meta">
                  <span><small>Payment</small><strong>{labelPaymentStatus(order.payment_status)}</strong></span>
                  <span><small>Delivery</small><strong>{order.tracking_reference || order.estimated_delivery_date ? "Tracking available" : "Awaiting update"}</strong></span>
                  <span><small>Documents</small><strong>{orderDocuments.length} issued</strong></span>
                </div>
                <footer>
                  <strong>{formatNpr(Number(order.total))}</strong>
                  <Link href={`/account/orders/${encodeURIComponent(order.order_number)}`}>Track and view details <ArrowRight /></Link>
                </footer>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}

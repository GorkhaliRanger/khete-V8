"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleDollarSign, Clock3, ExternalLink, FileText, LoaderCircle, MapPin, PackageCheck, ReceiptText, RefreshCw, Save, Search, ShieldCheck, ShoppingBag, Truck, UserRound } from "lucide-react";
import { AdminAccessCard, type AdminAccessState } from "@/components/admin-access-card";
import { AdminSidebar } from "@/components/admin-sidebar";
import { formatNpr } from "@/data/marketplace";
import { formatOrderDate, labelOrderDocumentType, labelOrderStatus, labelPaymentStatus, orderDocumentSelect, orderItemSelect, orderSelect, orderStatuses, paymentStatuses, type OrderDocumentRow, type OrderDocumentType, type OrderItemRow, type OrderRow, type OrderStatus, type OrderWithItems, type PaymentStatus } from "@/lib/orders";
import { createClient } from "@/lib/supabase/client";

const orderRoles = new Set(["super_admin", "order_delivery_manager", "customer_support", "finance_manager"]);

type HistoryRow = {
  id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  note: string | null;
  created_at: string;
};

function orderError(value: unknown) {
  const message = value instanceof Error ? value.message : "The orders workspace could not be loaded.";
  if (message.includes("relation") || message.includes("schema cache") || message.includes("order_document") || message.includes("return_window_ends_at")) return "Run the latest Order Tracking & Documents migration in Supabase before opening this workspace.";
  return message;
}

function OrderEditor({ order, onSaved }: { order: OrderWithItems; onSaved: () => Promise<void> }) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(order.payment_status);
  const [deliveryFee, setDeliveryFee] = useState(String(order.delivery_fee));
  const [trackingReference, setTrackingReference] = useState(order.tracking_reference ?? "");
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState(order.estimated_delivery_date ?? "");
  const [returnWindowEndsAt, setReturnWindowEndsAt] = useState(order.return_window_ends_at ?? "");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [documents, setDocuments] = useState<OrderDocumentRow[]>([]);
  const [issuerLegalName, setIssuerLegalName] = useState("");
  const [issuerPanVat, setIssuerPanVat] = useState("");
  const [issuerAddress, setIssuerAddress] = useState("");
  const [issuerEmail, setIssuerEmail] = useState("");
  const [issuerPhone, setIssuerPhone] = useState("");
  const [documentNote, setDocumentNote] = useState("");
  const [issuing, setIssuing] = useState<OrderDocumentType | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const loadOrderRecords = async () => {
      const supabase = createClient();
      const [{ data: historyData }, { data: documentData }] = await Promise.all([
        supabase
          .from("order_status_history")
          .select("id,status,payment_status,note,created_at")
          .eq("order_id", order.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("order_documents")
          .select(orderDocumentSelect)
          .eq("order_id", order.id)
          .order("issued_at", { ascending: false }),
      ]);
      if (mounted) {
        setHistory((historyData ?? []) as unknown as HistoryRow[]);
        const rows = (documentData ?? []) as unknown as OrderDocumentRow[];
        setDocuments(rows);
        const latestIssuer = rows.find((document) => document.issuer_legal_name || document.issuer_pan_vat || document.issuer_address);
        if (latestIssuer) {
          setIssuerLegalName(latestIssuer.issuer_legal_name ?? "");
          setIssuerPanVat(latestIssuer.issuer_pan_vat ?? "");
          setIssuerAddress(latestIssuer.issuer_address ?? "");
          setIssuerEmail(latestIssuer.issuer_email ?? "");
          setIssuerPhone(latestIssuer.issuer_phone ?? "");
        }
      }
    };
    void loadOrderRecords();
    return () => { mounted = false; };
  }, [order.id]);

  async function reloadDocuments() {
    const supabase = createClient();
    const { data } = await supabase
      .from("order_documents")
      .select(orderDocumentSelect)
      .eq("order_id", order.id)
      .order("issued_at", { ascending: false });
    setDocuments((data ?? []) as unknown as OrderDocumentRow[]);
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const fee = Number(deliveryFee);
      if (!Number.isFinite(fee) || fee < 0) throw new Error("Enter a valid delivery fee of zero or more.");
      const supabase = createClient();
      const { error: updateError } = await supabase.rpc("update_marketplace_order", {
        p_order_id: order.id,
        p_status: status,
        p_payment_status: paymentStatus,
        p_delivery_fee: fee,
        p_tracking_reference: trackingReference || null,
        p_estimated_delivery_date: estimatedDeliveryDate || null,
        p_note: note || null,
      });
      if (updateError) throw updateError;
      const { error: returnWindowError } = await supabase.rpc("set_order_return_window", {
        p_order_id: order.id,
        p_return_window_ends_at: returnWindowEndsAt || null,
        p_note: null,
      });
      if (returnWindowError) throw returnWindowError;
      setNote("");
      setMessage("Order updated successfully.");
      await onSaved();
      const { data } = await supabase
        .from("order_status_history")
        .select("id,status,payment_status,note,created_at")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false });
      setHistory((data ?? []) as unknown as HistoryRow[]);
      await reloadDocuments();
    } catch (caught) {
      setError(orderError(caught));
    } finally {
      setSaving(false);
    }
  }

  async function issueDocument(type: OrderDocumentType) {
    setIssuing(type);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      const { error: issueError } = await supabase.rpc("issue_order_document", {
        p_order_id: order.id,
        p_document_type: type,
        p_issuer: {
          legal_name: issuerLegalName,
          pan_vat: issuerPanVat,
          address: issuerAddress,
          email: issuerEmail,
          phone: issuerPhone,
        },
        p_note: documentNote || null,
      });
      if (issueError) throw issueError;
      setDocumentNote("");
      setMessage(`${labelOrderDocumentType(type)} issued successfully.`);
      await reloadDocuments();
      const { data } = await supabase
        .from("order_status_history")
        .select("id,status,payment_status,note,created_at")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false });
      setHistory((data ?? []) as unknown as HistoryRow[]);
    } catch (caught) {
      setError(orderError(caught));
    } finally {
      setIssuing(null);
    }
  }

  return (
    <section className="admin-order-detail">
      <header className="admin-order-detail-head">
        <div><p className="eyebrow">Order details</p><h2>{order.order_number}</h2><span>{formatOrderDate(order.placed_at)}</span></div>
        <div className="admin-order-total"><small>Order total</small><strong>{formatNpr(Number(order.total))}</strong><Link href={`/account/orders/${encodeURIComponent(order.order_number)}`} target="_blank">Customer view <ExternalLink /></Link></div>
      </header>

      <div className="admin-order-info-grid">
        <article><UserRound /><div><small>Customer</small><strong>{order.customer_name}</strong><span>{order.customer_phone}<br />{order.customer_email}</span></div></article>
        <article><MapPin /><div><small>Delivery address</small><strong>{order.area}, Ward {order.ward}</strong><span>{order.street_address}<br />{order.municipality}, {order.district}</span></div></article>
      </div>
      {order.delivery_note ? <p className="admin-order-note"><strong>Delivery note:</strong> {order.delivery_note}</p> : null}
      {order.customer_delivery_confirmed_at ? <p className="admin-order-customer-confirmed"><CheckCircle2 /><span><strong>Customer confirmed delivery</strong><small>{formatOrderDate(order.customer_delivery_confirmed_at)}{order.customer_delivery_note ? ` · ${order.customer_delivery_note}` : ""}</small></span></p> : null}

      <section className="admin-order-items">
        <h3>Items</h3>
        {order.items.map((item) => <div key={item.id}><span><strong>{item.listing_name}</strong>{item.variant_name ? <small>{item.variant_name}</small> : null}{item.sku ? <em>SKU: {item.sku}</em> : null}</span><span>{Number(item.quantity)} {item.unit_label || "item"}{Number(item.quantity) === 1 ? "" : "s"} × {formatNpr(Number(item.unit_price))}</span><b>{formatNpr(Number(item.line_total))}</b></div>)}
        <footer><span>Subtotal <strong>{formatNpr(Number(order.subtotal))}</strong></span><span>Delivery <strong>{formatNpr(Number(order.delivery_fee))}</strong></span><span>Total <strong>{formatNpr(Number(order.total))}</strong></span></footer>
      </section>

      <section className="admin-order-update">
        <div className="admin-form-section-heading"><div><h3>Order and delivery update</h3><p>Changes are recorded in the order history. Cancelling releases reserved stock; delivery finalizes non-variant stock.</p></div></div>
        <div className="form-grid">
          <label>Order status<select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)}>{orderStatuses.map((item) => <option key={item} value={item}>{labelOrderStatus(item)}</option>)}</select></label>
          <label>Payment status<select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as PaymentStatus)}>{paymentStatuses.map((item) => <option key={item} value={item}>{labelPaymentStatus(item)}</option>)}</select></label>
          <label>Delivery fee (NPR)<input type="number" min="0" step="0.01" value={deliveryFee} onChange={(event) => setDeliveryFee(event.target.value)} /></label>
          <label>Estimated delivery<input type="date" value={estimatedDeliveryDate} onChange={(event) => setEstimatedDeliveryDate(event.target.value)} /></label>
          <label>Return/replacement window ends<input type="date" value={returnWindowEndsAt} onChange={(event) => setReturnWindowEndsAt(event.target.value)} /></label>
          <label className="span-two">Tracking / dispatch reference<input value={trackingReference} onChange={(event) => setTrackingReference(event.target.value)} placeholder="Optional tracking or delivery reference" /></label>
          <label className="span-two">Internal update note<textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reason for this status or payment update" /></label>
        </div>
        {error ? <p className="admin-order-message error">{error}</p> : null}
        {message ? <p className="admin-order-message success"><CheckCircle2 /> {message}</p> : null}
        <div className="admin-form-actions"><button className="primary-button" type="button" disabled={saving} onClick={() => void save()}>{saving ? <LoaderCircle className="admin-spinner" /> : <Save />} {saving ? "Saving…" : "Save order update"}</button></div>
      </section>

      <section className="admin-order-documents">
        <div className="admin-form-section-heading"><div><h3>Customer documents</h3><p>The order confirmation is automatic. Payment and tax invoices are issued only after the required order conditions are recorded.</p></div><ReceiptText /></div>
        <div className="admin-order-document-list">
          {documents.length ? documents.map((document) => (
            <article key={document.id}>
              <FileText />
              <span><strong>{labelOrderDocumentType(document.document_type)}</strong><small>{document.document_number} · {formatOrderDate(document.issued_at)}</small></span>
              <i className={document.status}>{document.status}</i>
            </article>
          )) : <p>No documents have been issued for this order.</p>}
        </div>

        <details className="admin-order-issuer">
          <summary><ShieldCheck /> Invoice issuer details <span>Required for tax invoices</span></summary>
          <div className="form-grid">
            <label>Legal issuer name<input value={issuerLegalName} onChange={(event) => setIssuerLegalName(event.target.value)} placeholder="Registered business or legal name" /></label>
            <label>PAN/VAT number<input value={issuerPanVat} onChange={(event) => setIssuerPanVat(event.target.value)} placeholder="Registered PAN or VAT number" /></label>
            <label className="span-two">Registered address<input value={issuerAddress} onChange={(event) => setIssuerAddress(event.target.value)} placeholder="Registered business address" /></label>
            <label>Email<input type="email" value={issuerEmail} onChange={(event) => setIssuerEmail(event.target.value)} /></label>
            <label>Phone<input value={issuerPhone} onChange={(event) => setIssuerPhone(event.target.value)} /></label>
            <label className="span-two">Document note<textarea rows={2} value={documentNote} onChange={(event) => setDocumentNote(event.target.value)} placeholder="Optional note shown on the issued document" /></label>
          </div>
        </details>

        <div className="admin-order-document-actions">
          <button type="button" disabled={issuing !== null} onClick={() => void issueDocument("order_confirmation")}>{issuing === "order_confirmation" ? <LoaderCircle className="admin-spinner" /> : <FileText />} Reissue confirmation</button>
          <button type="button" disabled={issuing !== null || !["paid", "partially_refunded"].includes(paymentStatus)} onClick={() => void issueDocument("payment_invoice")}>{issuing === "payment_invoice" ? <LoaderCircle className="admin-spinner" /> : <ReceiptText />} Issue payment invoice</button>
          <button type="button" disabled={issuing !== null || status !== "delivered" || !["paid", "partially_refunded"].includes(paymentStatus) || !returnWindowEndsAt || returnWindowEndsAt >= new Date().toISOString().slice(0, 10)} onClick={() => void issueDocument("tax_invoice")}>{issuing === "tax_invoice" ? <LoaderCircle className="admin-spinner" /> : <ShieldCheck />} Issue tax invoice</button>
        </div>
        <p className="admin-order-document-guidance">Save the latest order, payment, delivery and return-window updates before issuing an invoice. A tax invoice also requires legal issuer details.</p>
      </section>

      <section className="admin-order-history">
        <h3>Order history</h3>
        {history.length ? history.map((entry) => <div key={entry.id}><Clock3 /><span><strong>{labelOrderStatus(entry.status)} · {labelPaymentStatus(entry.payment_status)}</strong><small>{formatOrderDate(entry.created_at)}</small>{entry.note ? <p>{entry.note}</p> : null}</span></div>) : <p>No history entries are available yet.</p>}
      </section>
    </section>
  );
}

export default function AdminOrdersPage() {
  const [access, setAccess] = useState<AdminAccessState>("loading");
  const [accountEmail, setAccountEmail] = useState("");
  const [detectedRoles, setDetectedRoles] = useState<string[]>([]);
  const [currentOrigin, setCurrentOrigin] = useState("");
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: orderData, error: ordersError } = await supabase
        .from("orders")
        .select(orderSelect)
        .order("created_at", { ascending: false })
        .limit(200);
      if (ordersError) throw ordersError;
      const rows = (orderData ?? []) as unknown as OrderRow[];
      const ids = rows.map((order) => order.id);
      let itemRows: OrderItemRow[] = [];
      if (ids.length) {
        const { data: itemData, error: itemsError } = await supabase
          .from("order_items")
          .select(orderItemSelect)
          .in("order_id", ids);
        if (itemsError) throw itemsError;
        itemRows = (itemData ?? []) as unknown as OrderItemRow[];
      }
      const merged = rows.map((order) => ({ ...order, items: itemRows.filter((item) => item.order_id === order.id) }));
      setOrders(merged);
      setSelectedId((current) => current && merged.some((order) => order.id === current) ? current : merged[0]?.id ?? "");
    } catch (caught) {
      setError(orderError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const checkAccess = async () => {
      try {
        if (mounted) setCurrentOrigin(window.location.origin);
        const supabase = createClient();
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) {
          if (mounted) setAccess("signed-out");
          return;
        }
        if (mounted) setAccountEmail(authData.user.email ?? "");
        const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", authData.user.id);
        if (roleError) throw roleError;
        const names = (roles ?? []).map((item) => item.role);
        if (mounted) setDetectedRoles(names);
        if (!names.some((role) => orderRoles.has(role))) {
          if (mounted) setAccess("denied");
          return;
        }
        if (!mounted) return;
        setAccess("allowed");
        await loadOrders();
      } catch (caught) {
        if (!mounted) return;
        setError(orderError(caught));
        setAccess("error");
      }
    };
    void checkAccess();
    return () => { mounted = false; };
  }, [loadOrders]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (!needle) return true;
      return [order.order_number, order.customer_name, order.customer_email, order.customer_phone, order.district, ...order.items.map((item) => item.listing_name)].some((value) => value.toLowerCase().includes(needle));
    });
  }, [orders, query, statusFilter]);

  const selected = orders.find((order) => order.id === selectedId) ?? null;
  const activeCount = orders.filter((order) => !["delivered", "cancelled", "returned", "refunded"].includes(order.status)).length;
  const awaitingPayment = orders.filter((order) => order.payment_status === "unpaid" || order.payment_status === "pending").length;

  if (access !== "allowed") return <AdminAccessCard access={access} email={accountEmail} roles={detectedRoles} origin={currentOrigin} resource="orders" error={error} requirement="the Super Admin, Order & Delivery, Customer Support, or Finance Manager role" />;

  return (
    <main className="admin-shell admin-orders-page">
      <AdminSidebar active="orders" />
      <section className="admin-main">
        <header className="admin-page-heading"><div><p className="eyebrow">Order operations</p><h1>Orders & delivery</h1><p>Review incoming order requests, payment state, fulfilment, dispatch and delivery from one workspace.</p></div><div className="admin-create-actions"><button type="button" onClick={() => void loadOrders()} disabled={loading}>{loading ? <LoaderCircle className="admin-spinner" /> : <RefreshCw />} Refresh orders</button></div></header>
        <div className="admin-order-stats"><article><ShoppingBag /><span><small>Total orders</small><strong>{orders.length}</strong></span></article><article><Truck /><span><small>Active fulfilment</small><strong>{activeCount}</strong></span></article><article><CircleDollarSign /><span><small>Awaiting payment</small><strong>{awaitingPayment}</strong></span></article><article><PackageCheck /><span><small>Delivered</small><strong>{orders.filter((order) => order.status === "delivered").length}</strong></span></article></div>
        {error ? <p className="admin-notice admin-error-notice">{error}</p> : null}
        <div className="admin-orders-layout">
          <aside className="admin-orders-list-panel">
            <div className="admin-orders-filters"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Order, customer, phone…" /></label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | OrderStatus)}><option value="all">All statuses</option>{orderStatuses.map((status) => <option key={status} value={status}>{labelOrderStatus(status)}</option>)}</select></div>
            <div className="admin-orders-list">{loading && !orders.length ? <div className="admin-list-empty"><LoaderCircle className="admin-spinner" /> Loading orders…</div> : null}{!loading && !filtered.length ? <div className="admin-list-empty"><ShoppingBag /><strong>No matching orders</strong><span>New order requests will appear here.</span></div> : filtered.map((order) => <button className={order.id === selectedId ? "selected" : ""} type="button" key={order.id} onClick={() => setSelectedId(order.id)}><span><strong>{order.order_number}</strong><small>{order.customer_name} · {order.district}</small><em>{formatOrderDate(order.placed_at)}</em></span><span><b>{formatNpr(Number(order.total))}</b><i className={`order-status order-status-${order.status}`}>{labelOrderStatus(order.status)}</i></span></button>)}</div>
          </aside>
          {selected ? <OrderEditor key={selected.id} order={selected} onSaved={loadOrders} /> : <section className="admin-order-detail admin-empty-panel"><ShoppingBag /><h2>Select an order</h2><p>Order and delivery details will appear here.</p></section>}
        </div>
      </section>
    </main>
  );
}

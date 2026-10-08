"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Headphones,
  LoaderCircle,
  MapPin,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import { formatNpr } from "@/data/marketplace";
import {
  formatOrderDate,
  formatOrderDay,
  labelOrderDocumentType,
  labelOrderStatus,
  labelPaymentStatus,
  orderDocumentSelect,
  orderError,
  orderHistorySelect,
  orderItemSelect,
  orderSelect,
  type OrderDocumentRow,
  type OrderHistoryRow,
  type OrderItemRow,
  type OrderRow,
  type OrderStatus,
  type OrderWithItems,
} from "@/lib/orders";
import {
  labelSupportStatus,
  supportTicketSelect,
  type SupportTicketRow,
} from "@/lib/support";
import { createClient } from "@/lib/supabase/client";
import { useMarketplace } from "./marketplace-provider";

const stages = [
  { label: "Submitted", description: "Order request received" },
  { label: "Confirmed", description: "Order accepted by khetE" },
  { label: "Processing", description: "Items are being prepared" },
  { label: "Dispatched", description: "Order is on the way" },
  { label: "Delivered", description: "Delivery completed" },
];

const stageByStatus: Record<OrderStatus, number> = {
  pending_payment: 0,
  payment_review: 0,
  confirmed: 1,
  processing: 2,
  ready_for_dispatch: 2,
  dispatched: 3,
  delivered: 4,
  cancelled: -1,
  returned: -1,
  refunded: -1,
};

function supportHref(type: string, orderNumber: string, subject: string) {
  const params = new URLSearchParams({ type, order: orderNumber, subject });
  return `/support?${params.toString()}`;
}

export function CustomerOrderDetail({ orderNumber }: { orderNumber: string }) {
  const { user, authReady, openLogin } = useMarketplace();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [history, setHistory] = useState<OrderHistoryRow[]>([]);
  const [documents, setDocuments] = useState<OrderDocumentRow[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicketRow[]>([]);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [today, setToday] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadOrder = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: orderData, error: orderLoadError } = await supabase
        .from("orders")
        .select(orderSelect)
        .eq("customer_id", user.id)
        .eq("order_number", orderNumber)
        .maybeSingle();
      if (orderLoadError) throw orderLoadError;
      if (!orderData) throw new Error("This order was not found in your account.");
      const row = orderData as unknown as OrderRow;

      const [
        { data: itemData, error: itemError },
        { data: historyData, error: historyError },
        { data: documentData, error: documentError },
        { data: supportData },
      ] = await Promise.all([
        supabase.from("order_items").select(orderItemSelect).eq("order_id", row.id).order("created_at"),
        supabase.from("order_status_history").select(orderHistorySelect).eq("order_id", row.id).order("created_at", { ascending: false }),
        supabase.from("order_documents").select(orderDocumentSelect).eq("order_id", row.id).eq("status", "issued").order("issued_at", { ascending: false }),
        supabase.from("support_tickets").select(supportTicketSelect).eq("customer_id", user.id).eq("order_number", orderNumber).order("last_message_at", { ascending: false }),
      ]);
      if (itemError) throw itemError;
      if (historyError) throw historyError;
      if (documentError) throw documentError;

      setOrder({ ...row, items: (itemData ?? []) as unknown as OrderItemRow[] });
      setHistory((historyData ?? []) as unknown as OrderHistoryRow[]);
      setDocuments((documentData ?? []) as unknown as OrderDocumentRow[]);
      setSupportTickets((supportData ?? []) as unknown as SupportTicketRow[]);
    } catch (caught) {
      setError(orderError(caught));
    } finally {
      setLoading(false);
    }
  }, [orderNumber, user]);

  useEffect(() => {
    if (!authReady) return;
    queueMicrotask(() => void loadOrder());
  }, [authReady, loadOrder]);

  useEffect(() => {
    queueMicrotask(() => setToday(new Date().toISOString().slice(0, 10)));
  }, []);

  const currentStage = order ? stageByStatus[order.status] : 0;
  const canCancel = order ? ["pending_payment", "payment_review", "confirmed", "processing"].includes(order.status) : false;
  const canRequestReturn = order?.status === "delivered"
    && (!order.return_window_ends_at || !today || order.return_window_ends_at >= today);

  const latestMeaningfulHistory = useMemo(() => {
    const seen = new Set<string>();
    return history.filter((entry) => {
      const key = `${entry.status}-${entry.payment_status}-${entry.note ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [history]);

  async function confirmDelivery() {
    if (!order) return;
    setConfirming(true);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      const { error: confirmError } = await supabase.rpc("confirm_marketplace_delivery", {
        p_order_id: order.id,
        p_note: deliveryNote || null,
      });
      if (confirmError) throw confirmError;
      setDeliveryNote("");
      setMessage("Delivery confirmation saved.");
      await loadOrder();
    } catch (caught) {
      setError(orderError(caught));
    } finally {
      setConfirming(false);
    }
  }

  if (!authReady || (loading && !order)) {
    return <main className="simple-page"><div className="site-container account-loading"><LoaderCircle className="admin-spinner" /> Loading order details…</div></main>;
  }

  if (!user) {
    return (
      <main className="simple-page">
        <div className="site-container empty-state account-guest">
          <UserRound />
          <h1>Log in to open this order.</h1>
          <p>Tracking, documents and delivery confirmations are private to the customer account that placed the order.</p>
          <button className="primary-button" type="button" onClick={openLogin}>Login or register</button>
        </div>
      </main>
    );
  }

  if (error && !order) {
    return (
      <main className="simple-page">
        <div className="site-container empty-state customer-order-error">
          <AlertTriangle />
          <h1>Order details unavailable</h1>
          <p>{error}</p>
          <div><button className="primary-button" type="button" onClick={() => void loadOrder()}><RefreshCw /> Try again</button><Link className="secondary-button" href="/account/orders">My orders</Link></div>
        </div>
      </main>
    );
  }

  if (!order) return null;

  return (
    <main className="customer-order-detail-page">
      <div className="site-container">
        <Link className="customer-order-back" href="/account/orders"><ArrowLeft /> Back to my orders</Link>

        <header className="customer-order-detail-hero">
          <div>
            <p className="eyebrow">Order tracking</p>
            <h1>{order.order_number}</h1>
            <p>Placed {formatOrderDate(order.placed_at)}</p>
          </div>
          <div className="customer-order-detail-badges">
            <span className={`order-status order-status-${order.status}`}>{labelOrderStatus(order.status)}</span>
            <span>{labelPaymentStatus(order.payment_status)}</span>
            <strong>{formatNpr(Number(order.total))}</strong>
          </div>
        </header>

        {message ? <p className="customer-order-message success"><CheckCircle2 /> {message}</p> : null}
        {error ? <p className="customer-order-message error"><AlertTriangle /> {error}</p> : null}

        <section className={`customer-order-progress ${currentStage < 0 ? "is-terminal" : ""}`} aria-label="Order progress">
          {currentStage < 0 ? (
            <div className="customer-order-terminal"><AlertTriangle /><span><strong>{labelOrderStatus(order.status)}</strong><small>See the recorded history below for the latest update.</small></span></div>
          ) : stages.map((stage, index) => (
            <div className={index < currentStage ? "complete" : index === currentStage ? "current" : ""} key={stage.label}>
              <span>{index <= currentStage ? <Check /> : index + 1}</span>
              <strong>{stage.label}</strong>
              <small>{stage.description}</small>
            </div>
          ))}
        </section>

        <div className="customer-order-detail-layout">
          <div className="customer-order-detail-main">
            <section className="customer-order-panel">
              <header><div><p className="eyebrow">Delivery</p><h2>Tracking and address</h2></div><Truck /></header>
              <div className="customer-order-delivery-grid">
                <article><MapPin /><span><small>Delivery address</small><strong>{order.area}, Ward {order.ward}</strong><p>{order.street_address}<br />{order.municipality}, {order.district}</p></span></article>
                <article><Truck /><span><small>Tracking reference</small><strong>{order.tracking_reference || "Not assigned yet"}</strong><p>{order.estimated_delivery_date ? `Estimated delivery: ${formatOrderDay(order.estimated_delivery_date)}` : "The khetE team will add an estimate after fulfilment begins."}</p></span></article>
              </div>
              {order.delivery_note ? <p className="customer-order-delivery-note"><strong>Your delivery note:</strong> {order.delivery_note}</p> : null}
              {order.return_window_ends_at ? <p className="customer-order-return-window"><ShieldCheck /> Return or replacement requests are accepted through <strong>{formatOrderDay(order.return_window_ends_at)}</strong>, subject to the applicable policy.</p> : null}
            </section>

            <section className="customer-order-panel">
              <header><div><p className="eyebrow">Order contents</p><h2>Items and totals</h2></div><PackageCheck /></header>
              <div className="customer-order-detail-items">
                {order.items.map((item) => (
                  <div key={item.id}>
                    <span><strong>{item.listing_name}</strong>{item.variant_name ? <small>{item.variant_name}</small> : null}{item.sku ? <em>SKU: {item.sku}</em> : null}</span>
                    <span>{Number(item.quantity)} {item.unit_label || "item"}{Number(item.quantity) === 1 ? "" : "s"} × {formatNpr(Number(item.unit_price))}</span>
                    <b>{formatNpr(Number(item.line_total))}</b>
                  </div>
                ))}
              </div>
              <div className="customer-order-totals">
                <span>Subtotal <strong>{formatNpr(Number(order.subtotal))}</strong></span>
                <span>Delivery <strong>{formatNpr(Number(order.delivery_fee))}</strong></span>
                {Number(order.discount_total) ? <span>Discount <strong>− {formatNpr(Number(order.discount_total))}</strong></span> : null}
                <span>Total <strong>{formatNpr(Number(order.total))}</strong></span>
              </div>
            </section>

            <section className="customer-order-panel">
              <header><div><p className="eyebrow">Recorded updates</p><h2>Order history</h2></div><Clock3 /></header>
              <div className="customer-order-history">
                {latestMeaningfulHistory.map((entry) => (
                  <div key={entry.id}>
                    <Clock3 />
                    <span>
                      <strong>{labelOrderStatus(entry.status)} · {labelPaymentStatus(entry.payment_status)}</strong>
                      <small>{formatOrderDate(entry.created_at)}</small>
                      {entry.note ? <p>{entry.note}</p> : null}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="customer-order-detail-side">
            <section className="customer-order-panel customer-order-documents">
              <header><div><p className="eyebrow">Documents</p><h2>Confirmations and invoices</h2></div><ReceiptText /></header>
              {documents.length ? documents.map((document) => (
                <Link href={`/account/orders/${encodeURIComponent(order.order_number)}/document/${document.document_type}`} key={document.id}>
                  <FileText />
                  <span><strong>{labelOrderDocumentType(document.document_type)}</strong><small>{document.document_number}<br />Issued {formatOrderDate(document.issued_at)}</small></span>
                  <em>Open</em>
                </Link>
              )) : <p>No documents have been issued yet.</p>}
              <small className="customer-order-document-note">Order confirmations do not prove payment. Payment and tax invoices appear only after Finance issues them.</small>
            </section>

            {order.status === "delivered" && !order.customer_delivery_confirmed_at ? (
              <section className="customer-order-panel customer-delivery-confirm">
                <header><div><p className="eyebrow">Customer action</p><h2>Confirm delivery</h2></div><CheckCircle2 /></header>
                <p>Confirm only after the order has reached you. Add an optional note for the khetE team.</p>
                <textarea value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} maxLength={500} rows={3} placeholder="Optional delivery note" />
                <button className="primary-button" type="button" disabled={confirming} onClick={() => void confirmDelivery()}>{confirming ? <LoaderCircle className="admin-spinner" /> : <CheckCircle2 />} {confirming ? "Saving…" : "Confirm delivery"}</button>
              </section>
            ) : order.customer_delivery_confirmed_at ? (
              <section className="customer-order-panel customer-delivery-confirm is-confirmed">
                <CheckCircle2 />
                <div><strong>Delivery confirmed</strong><small>{formatOrderDate(order.customer_delivery_confirmed_at)}</small>{order.customer_delivery_note ? <p>{order.customer_delivery_note}</p> : null}</div>
              </section>
            ) : null}

            <section className="customer-order-panel customer-order-help">
              <header><div><p className="eyebrow">Central support</p><h2>Need help?</h2></div><Headphones /></header>
              {canCancel ? <Link href={supportHref("return_request", order.order_number, `Cancellation request for ${order.order_number}`)}>Request cancellation</Link> : null}
              {canRequestReturn ? <Link href={supportHref("return_request", order.order_number, `Return or replacement request for ${order.order_number}`)}>Request return or replacement</Link> : null}
              <Link href={supportHref("delivery_issue", order.order_number, `Delivery help for ${order.order_number}`)}>Ask about delivery</Link>
              <Link href={supportHref("payment_issue", order.order_number, `Payment help for ${order.order_number}`)}>Ask about payment</Link>
              {supportTickets.length ? (
                <div className="customer-order-linked-tickets">
                  <strong>Linked support requests</strong>
                  {supportTickets.map((ticket) => <Link href="/support" key={ticket.id}><span>{ticket.ticket_number}</span><small>{labelSupportStatus(ticket.status)}</small></Link>)}
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

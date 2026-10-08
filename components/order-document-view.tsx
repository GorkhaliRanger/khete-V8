"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, FileText, LoaderCircle, Printer, UserRound } from "lucide-react";
import { formatNpr } from "@/data/marketplace";
import {
  formatOrderDate,
  labelOrderDocumentType,
  labelOrderStatus,
  labelPaymentStatus,
  orderDocumentSelect,
  orderDocumentTypes,
  orderError,
  orderItemSelect,
  orderSelect,
  type OrderDocumentRow,
  type OrderDocumentType,
  type OrderItemRow,
  type OrderRow,
  type OrderWithItems,
} from "@/lib/orders";
import { createClient } from "@/lib/supabase/client";
import { useMarketplace } from "./marketplace-provider";

export function OrderDocumentView({
  orderNumber,
  documentType,
}: {
  orderNumber: string;
  documentType: string;
}) {
  const { user, authReady, openLogin } = useMarketplace();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [document, setDocument] = useState<OrderDocumentRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDocument = useCallback(async () => {
    if (!user) return;
    if (!orderDocumentTypes.includes(documentType as OrderDocumentType)) {
      setError("This is not a valid order document type.");
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
        .eq("order_number", orderNumber)
        .maybeSingle();
      if (orderLoadError) throw orderLoadError;
      if (!orderData) throw new Error("This order was not found in your account.");
      const orderRow = orderData as unknown as OrderRow;

      const [{ data: itemData, error: itemError }, { data: documentData, error: documentError }] = await Promise.all([
        supabase.from("order_items").select(orderItemSelect).eq("order_id", orderRow.id).order("created_at"),
        supabase
          .from("order_documents")
          .select(orderDocumentSelect)
          .eq("order_id", orderRow.id)
          .eq("document_type", documentType)
          .eq("status", "issued")
          .maybeSingle(),
      ]);
      if (itemError) throw itemError;
      if (documentError) throw documentError;
      if (!documentData) throw new Error("This document has not been issued for the selected order.");

      setOrder({ ...orderRow, items: (itemData ?? []) as unknown as OrderItemRow[] });
      setDocument(documentData as unknown as OrderDocumentRow);
    } catch (caught) {
      setError(orderError(caught));
    } finally {
      setLoading(false);
    }
  }, [documentType, orderNumber, user]);

  useEffect(() => {
    if (!authReady) return;
    queueMicrotask(() => void loadDocument());
  }, [authReady, loadDocument]);

  if (!authReady || loading) {
    return <main className="simple-page"><div className="site-container account-loading"><LoaderCircle className="admin-spinner" /> Loading document…</div></main>;
  }

  if (!user) {
    return (
      <main className="simple-page">
        <div className="site-container empty-state account-guest">
          <UserRound />
          <h1>Log in to open this document.</h1>
          <p>Order documents are available only to the customer account that placed the order.</p>
          <button className="primary-button" type="button" onClick={openLogin}>Login or register</button>
        </div>
      </main>
    );
  }

  if (error || !order || !document) {
    return (
      <main className="simple-page">
        <div className="site-container empty-state customer-order-error">
          <AlertTriangle />
          <h1>Document unavailable</h1>
          <p>{error || "The requested document could not be loaded."}</p>
          <Link className="primary-button" href={`/account/orders/${encodeURIComponent(orderNumber)}`}>Back to order</Link>
        </div>
      </main>
    );
  }

  const isOrderConfirmation = document.document_type === "order_confirmation";
  const isTaxInvoice = document.document_type === "tax_invoice";

  return (
    <main className="order-document-page">
      <div className="site-container">
        <nav className="order-document-actions" aria-label="Document actions">
          <Link className="secondary-button" href={`/account/orders/${encodeURIComponent(order.order_number)}`}><ArrowLeft /> Back to order</Link>
          <button className="primary-button" type="button" onClick={() => window.print()}><Printer /> Print or save PDF</button>
        </nav>

        <article className="order-document-sheet">
          <header className="order-document-header">
            <div className="order-document-brand">
              <Image src="/khete-logo-transparent.png" alt="khetE" width={260} height={104} priority />
              <p>From fields to futures</p>
            </div>
            <div>
              <p>{labelOrderDocumentType(document.document_type)}</p>
              <h1>{document.document_number}</h1>
              <span>Issued {formatOrderDate(document.issued_at)}</span>
            </div>
          </header>

          <section className="order-document-parties">
            <div>
              <small>{isTaxInvoice ? "Issued by" : "Marketplace record"}</small>
              <strong>{document.issuer_legal_name || "khetE Marketplace"}</strong>
              {document.issuer_pan_vat ? <span>PAN/VAT: {document.issuer_pan_vat}</span> : null}
              {document.issuer_address ? <span>{document.issuer_address}</span> : null}
              {document.issuer_email ? <span>{document.issuer_email}</span> : null}
              {document.issuer_phone ? <span>{document.issuer_phone}</span> : null}
            </div>
            <div>
              <small>Customer and delivery address</small>
              <strong>{order.customer_name}</strong>
              <span>{order.customer_email}</span>
              <span>{order.customer_phone}</span>
              <span>{order.street_address}, {order.area}, Ward {order.ward}</span>
              <span>{order.municipality}, {order.district}</span>
            </div>
          </section>

          <section className="order-document-meta">
            <span><small>Order number</small><strong>{order.order_number}</strong></span>
            <span><small>Order date</small><strong>{formatOrderDate(order.placed_at)}</strong></span>
            <span><small>Order status</small><strong>{labelOrderStatus(order.status)}</strong></span>
            <span><small>Payment status</small><strong>{labelPaymentStatus(order.payment_status)}</strong></span>
          </section>

          <section className="order-document-items">
            <div className="order-document-table-head"><span>Description</span><span>Quantity</span><span>Unit price</span><span>Amount</span></div>
            {order.items.map((item) => (
              <div key={item.id}>
                <span><strong>{item.listing_name}</strong>{item.variant_name ? <small>{item.variant_name}</small> : null}{item.sku ? <em>SKU: {item.sku}</em> : null}</span>
                <span>{Number(item.quantity)} {item.unit_label || "item"}{Number(item.quantity) === 1 ? "" : "s"}</span>
                <span>{formatNpr(Number(item.unit_price))}</span>
                <strong>{formatNpr(Number(item.line_total))}</strong>
              </div>
            ))}
          </section>

          <section className="order-document-summary">
            <div>
              {document.note ? <p><strong>Note:</strong> {document.note}</p> : null}
              {order.tracking_reference ? <p><strong>Tracking reference:</strong> {order.tracking_reference}</p> : null}
            </div>
            <div>
              <span>Subtotal <strong>{formatNpr(Number(document.subtotal))}</strong></span>
              <span>Delivery <strong>{formatNpr(Number(document.delivery_fee))}</strong></span>
              {Number(document.discount_total) ? <span>Discount <strong>− {formatNpr(Number(document.discount_total))}</strong></span> : null}
              <span>Total <strong>{formatNpr(Number(document.total))}</strong></span>
            </div>
          </section>

          <footer className="order-document-footer">
            <FileText />
            <p>{isOrderConfirmation
              ? "This order confirmation records the request received by khetE. It is not proof of payment and is not a tax invoice."
              : isTaxInvoice
                ? "This tax invoice was issued by the legal entity and PAN/VAT details shown above."
                : "This payment invoice is available because Finance recorded the order payment as paid. It is separate from any later statutory tax invoice."}</p>
          </footer>
        </article>
      </div>
    </main>
  );
}

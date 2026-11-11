"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, FileText, Headphones, LoaderCircle, Mail, MessageCircle, Paperclip, RefreshCw, Save, Search, Send, UserRound } from "lucide-react";
import { AdminAccessCard, type AdminAccessState } from "@/components/admin-access-card";
import { AdminSidebar } from "@/components/admin-sidebar";
import {
  formatSupportDate,
  formatSupportFileSize,
  labelSupportStatus,
  labelSupportType,
  supportAttachmentSelect,
  supportError,
  supportMessageSelect,
  supportPriorities,
  supportTicketSelect,
  supportTicketStatuses,
  supportTicketTypes,
  type SupportAttachmentRow,
  type SupportMessageRow,
  type SupportPriority,
  type SupportTicketRow,
  type SupportTicketStatus,
  type SupportTicketType,
} from "@/lib/support";
import { createClient } from "@/lib/supabase/admin-client";

const supportRoles = new Set(["super_admin", "customer_support", "order_delivery_manager"]);
const attachmentBucket = "support-attachments";
type AttachmentView = SupportAttachmentRow & { url: string };

function SupportEditor({ ticket, userId, onSaved }: { ticket: SupportTicketRow; userId: string; onSaved: () => Promise<void> }) {
  const [messages, setMessages] = useState<SupportMessageRow[]>([]);
  const [attachments, setAttachments] = useState<AttachmentView[]>([]);
  const [status, setStatus] = useState<SupportTicketStatus>(ticket.status);
  const [priority, setPriority] = useState<SupportPriority>(ticket.priority);
  const [assignedToMe, setAssignedToMe] = useState(ticket.assigned_to === userId);
  const [reply, setReply] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadMessages = useCallback(async () => {
    const supabase = createClient();
    const [{ data: messageData, error: messageError }, { data: attachmentData, error: attachmentError }] = await Promise.all([
      supabase
        .from("support_messages")
        .select(supportMessageSelect)
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("support_attachments")
        .select(supportAttachmentSelect)
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true }),
    ]);
    if (messageError || attachmentError) throw messageError ?? attachmentError;
    const rows = (attachmentData ?? []) as unknown as SupportAttachmentRow[];
    const linkedFiles = await Promise.all(rows.map(async (attachment) => {
      const { data } = await supabase.storage.from(attachmentBucket).createSignedUrl(attachment.storage_path, 3600);
      return { ...attachment, url: data?.signedUrl ?? "" };
    }));
    setMessages((messageData ?? []) as unknown as SupportMessageRow[]);
    setAttachments(linkedFiles);
  }, [ticket.id]);

  useEffect(() => {
    queueMicrotask(() => void loadMessages().catch((caught) => setError(supportError(caught))));
  }, [loadMessages]);

  async function saveTicket() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("support_tickets")
        .update({
          status,
          priority,
          assigned_to: assignedToMe ? userId : null,
        })
        .eq("id", ticket.id);
      if (updateError) throw updateError;
      setSuccess("Support request updated.");
      await onSaved();
    } catch (caught) {
      setError(supportError(caught));
    } finally {
      setLoading(false);
    }
  }

  async function sendReply() {
    if (!reply.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const supabase = createClient();
      const { error: replyError } = await supabase.rpc("add_support_message", {
        p_ticket_id: ticket.id,
        p_message: reply.trim(),
        p_internal: internalNote,
      });
      if (replyError) throw replyError;
      setReply("");
      setSuccess(internalNote ? "Internal note added." : "Reply sent to the customer.");
      await loadMessages();
      await onSaved();
    } catch (caught) {
      setError(supportError(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="admin-support-detail">
      <header className="admin-support-detail-head">
        <div><p className="eyebrow">{ticket.ticket_number}</p><h2>{ticket.subject}</h2><span>{labelSupportType(ticket.type)} · {formatSupportDate(ticket.created_at)}</span></div>
        <i className={`support-status support-status-${ticket.status}`}>{labelSupportStatus(ticket.status)}</i>
      </header>

      <div className="admin-support-contact">
        <article><UserRound /><span><small>Customer</small><strong>{ticket.contact_name}</strong><em>{ticket.contact_phone || "No phone supplied"}</em></span></article>
        <article><Mail /><span><small>Email</small><strong>{ticket.contact_email}</strong><em>{ticket.order_number ? `Order ${ticket.order_number}` : "No order linked"}</em></span></article>
      </div>

      <div className="admin-support-controls">
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as SupportTicketStatus)}>{supportTicketStatuses.map((item) => <option key={item} value={item}>{labelSupportStatus(item)}</option>)}</select></label>
        <label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as SupportPriority)}>{supportPriorities.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></label>
        <label className="admin-support-assignment"><input type="checkbox" checked={assignedToMe} onChange={(event) => setAssignedToMe(event.target.checked)} /> Assigned to me</label>
        <button className="secondary-button" type="button" disabled={loading} onClick={() => void saveTicket()}><Save /> Save request</button>
      </div>

      <section className="admin-support-thread">
        <h3>Conversation</h3>
        {messages.map((message) => <article className={`${message.sender_kind === "team" ? "team" : "customer"} ${message.is_internal ? "internal" : ""}`} key={message.id}><span><strong>{message.is_internal ? "Internal team note" : message.sender_kind === "team" ? "khetE Support" : ticket.contact_name}</strong><small><Clock3 /> {formatSupportDate(message.created_at)}</small></span><p>{message.body}</p></article>)}
      </section>

      {attachments.length ? <section className="admin-support-files"><h3><Paperclip /> Supporting files</h3><div>{attachments.map((attachment) => attachment.url ? <a href={attachment.url} target="_blank" rel="noopener noreferrer" key={attachment.id}><FileText /><span><strong>{attachment.file_name}</strong><small>{formatSupportFileSize(attachment.size_bytes)}</small></span></a> : null)}</div></section> : null}

      <section className="admin-support-reply">
        <label>Reply or note<textarea rows={5} maxLength={4000} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a clear update for the customer or your team." /></label>
        <div><label><input type="checkbox" checked={internalNote} onChange={(event) => setInternalNote(event.target.checked)} /> Internal note only</label><button className="primary-button" type="button" disabled={loading || !reply.trim()} onClick={() => void sendReply()}>{loading ? <LoaderCircle className="admin-spinner" /> : internalNote ? <MessageCircle /> : <Send />} {internalNote ? "Add note" : "Send reply"}</button></div>
      </section>

      {error ? <p className="admin-order-message error">{error}</p> : null}
      {success ? <p className="admin-order-message success"><CheckCircle2 /> {success}</p> : null}
    </section>
  );
}

export default function AdminSupportPage() {
  const [access, setAccess] = useState<AdminAccessState>("loading");
  const [accountEmail, setAccountEmail] = useState("");
  const [detectedRoles, setDetectedRoles] = useState<string[]>([]);
  const [currentOrigin, setCurrentOrigin] = useState("");
  const [userId, setUserId] = useState("");
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SupportTicketStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | SupportTicketType>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data, error: ticketError } = await supabase
        .from("support_tickets")
        .select(supportTicketSelect)
        .order("last_message_at", { ascending: false })
        .limit(300);
      if (ticketError) throw ticketError;
      const rows = (data ?? []) as unknown as SupportTicketRow[];
      setTickets(rows);
      setSelectedId((current) => current && rows.some((ticket) => ticket.id === current) ? current : rows[0]?.id ?? "");
    } catch (caught) {
      setError(supportError(caught));
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
        if (mounted) {
          setAccountEmail(authData.user.email ?? "");
          setUserId(authData.user.id);
        }
        const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", authData.user.id);
        if (roleError) throw roleError;
        const names = (roles ?? []).map((item) => item.role);
        if (mounted) setDetectedRoles(names);
        if (!names.some((role) => supportRoles.has(role))) {
          if (mounted) setAccess("denied");
          return;
        }
        if (!mounted) return;
        setAccess("allowed");
        await loadTickets();
      } catch (caught) {
        if (!mounted) return;
        setError(supportError(caught));
        setAccess("error");
      }
    };
    void checkAccess();
    return () => { mounted = false; };
  }, [loadTickets]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (statusFilter !== "all" && ticket.status !== statusFilter) return false;
      if (typeFilter !== "all" && ticket.type !== typeFilter) return false;
      if (!needle) return true;
      return [ticket.ticket_number, ticket.subject, ticket.contact_name, ticket.contact_email, ticket.contact_phone ?? "", ticket.order_number ?? ""].some((value) => value.toLowerCase().includes(needle));
    });
  }, [query, statusFilter, tickets, typeFilter]);

  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null;
  const openCount = tickets.filter((ticket) => ["open", "in_progress"].includes(ticket.status)).length;
  const waitingCount = tickets.filter((ticket) => ticket.status === "awaiting_customer").length;
  const urgentCount = tickets.filter((ticket) => ticket.priority === "urgent" && !["resolved", "closed"].includes(ticket.status)).length;

  if (access !== "allowed") return <AdminAccessCard access={access} email={accountEmail} roles={detectedRoles} origin={currentOrigin} resource="customer support" error={error} requirement="the Super Admin, Customer Support, or Order & Delivery Manager role" returnTo="/admin/support" />;

  return (
    <main className="admin-shell admin-support-page">
      <AdminSidebar active="support" />
      <section className="admin-main">
        <header className="admin-page-heading"><div><p className="eyebrow">Customer care</p><h1>Support & enquiries</h1><p>Manage product questions, orders, delivery, payments, custom requests, applications, returns and replacements from one workspace.</p></div><div className="admin-create-actions"><button type="button" onClick={() => void loadTickets()} disabled={loading}>{loading ? <LoaderCircle className="admin-spinner" /> : <RefreshCw />} Refresh support</button></div></header>
        <div className="admin-support-stats"><article><Headphones /><span><small>All requests</small><strong>{tickets.length}</strong></span></article><article><MessageCircle /><span><small>Open work</small><strong>{openCount}</strong></span></article><article><Clock3 /><span><small>Awaiting customer</small><strong>{waitingCount}</strong></span></article><article><RefreshCw /><span><small>Urgent</small><strong>{urgentCount}</strong></span></article></div>
        {error ? <p className="admin-notice admin-error-notice">{error}</p> : null}
        <div className="admin-support-layout">
          <aside className="admin-support-list-panel">
            <div className="admin-support-filters"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ticket, customer, order…" /></label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | SupportTicketStatus)}><option value="all">All statuses</option>{supportTicketStatuses.map((status) => <option key={status} value={status}>{labelSupportStatus(status)}</option>)}</select><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | SupportTicketType)}><option value="all">All topics</option>{supportTicketTypes.map((type) => <option key={type} value={type}>{labelSupportType(type)}</option>)}</select></div>
            <div className="admin-support-list">{loading && !tickets.length ? <div className="admin-list-empty"><LoaderCircle className="admin-spinner" /> Loading support…</div> : null}{!loading && !filtered.length ? <div className="admin-list-empty"><Headphones /><strong>No matching requests</strong><span>New customer requests will appear here.</span></div> : filtered.map((ticket) => <button className={ticket.id === selectedId ? "selected" : ""} type="button" key={ticket.id} onClick={() => setSelectedId(ticket.id)}><span><strong>{ticket.ticket_number}</strong><small>{ticket.subject}</small><em>{ticket.contact_name} · {formatSupportDate(ticket.last_message_at)}</em></span><span><i className={`support-status support-status-${ticket.status}`}>{labelSupportStatus(ticket.status)}</i><b className={`support-priority support-priority-${ticket.priority}`}>{ticket.priority}</b></span></button>)}</div>
          </aside>
          {selected ? <SupportEditor key={selected.id} ticket={selected} userId={userId} onSaved={loadTickets} /> : <section className="admin-support-detail admin-empty-panel"><Headphones /><h2>Select a support request</h2><p>The customer conversation will appear here.</p></section>}
        </div>
      </section>
    </main>
  );
}

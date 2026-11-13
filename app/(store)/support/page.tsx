"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  Headphones,
  LoaderCircle,
  LogIn,
  MessageCircle,
  PackageSearch,
  Paperclip,
  Phone,
  RefreshCw,
  Send,
  ShieldCheck,
  Store,
  X,
} from "lucide-react";
import { BrandName } from "@/components/brand-name";
import { useMarketplace } from "@/components/marketplace-provider";
import {
  formatSupportDate,
  formatSupportFileSize,
  labelSupportStatus,
  labelSupportType,
  supportAttachmentSelect,
  supportError,
  supportMessageSelect,
  supportTicketSelect,
  supportTicketTypes,
  supportTopicOptions,
  supportTypesRequiringReference,
  type SupportAttachmentRow,
  type SupportMessageRow,
  type SupportTicketRow,
  type SupportTicketType,
} from "@/lib/support";
import { createClient } from "@/lib/supabase/client";
import { PHONE_CALL_URL, WHATSAPP_CHAT_URL, WHATSAPP_NUMBER } from "@/lib/contact";

type FormState = {
  type: SupportTicketType;
  name: string;
  email: string;
  phone: string;
  orderNumber: string;
  subject: string;
  message: string;
};

type AttachmentView = SupportAttachmentRow & { url: string };

const emptyForm: FormState = {
  type: "general_enquiry",
  name: "",
  email: "",
  phone: "",
  orderNumber: "",
  subject: "",
  message: "",
};

const attachmentBucket = "support-attachments";
const acceptedAttachmentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const maxAttachmentBytes = 5 * 1024 * 1024;
const maxAttachments = 5;

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(-120);
}

export default function SupportPage() {
  const { user, authReady, openLogin } = useMarketplace();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [files, setFiles] = useState<File[]>([]);
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [messages, setMessages] = useState<SupportMessageRow[]>([]);
  const [attachments, setAttachments] = useState<AttachmentView[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [reply, setReply] = useState("");
  const [submittedTicket, setSubmittedTicket] = useState<{ id: string; number: string } | null>(null);
  const [attachmentWarning, setAttachmentWarning] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replying, setReplying] = useState(false);
  const [error, setError] = useState("");

  const requiresReference = supportTypesRequiringReference.has(form.type);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const requestedType = searchParams.get("type");
    const type = supportTicketTypes.includes(requestedType as SupportTicketType)
      ? requestedType as SupportTicketType
      : "general_enquiry";
    const orderNumber = searchParams.get("order")?.trim() ?? "";
    const subject = searchParams.get("subject")?.trim() ?? "";
    queueMicrotask(() => setForm((current) => ({ ...current, type, orderNumber, subject: subject || current.subject })));
  }, []);

  useEffect(() => {
    if (!user) return;
    queueMicrotask(() => setForm((current) => ({
      ...current,
      name: current.name || (typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : ""),
      email: current.email || user.email || "",
    })));
  }, [user]);

  const loadTickets = useCallback(async () => {
    if (!user) {
      setTickets([]);
      setSelectedId("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data, error: ticketError } = await supabase
        .from("support_tickets")
        .select(supportTicketSelect)
        .eq("customer_id", user.id)
        .order("last_message_at", { ascending: false });
      if (ticketError) throw ticketError;
      const rows = (data ?? []) as unknown as SupportTicketRow[];
      setTickets(rows);
      setSelectedId((current) => current && rows.some((ticket) => ticket.id === current) ? current : rows[0]?.id ?? "");
    } catch (caught) {
      setError(supportError(caught));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authReady) return;
    queueMicrotask(() => void loadTickets());
  }, [authReady, loadTickets]);

  useEffect(() => {
    if (!selectedId || !user) {
      queueMicrotask(() => {
        setMessages([]);
        setAttachments([]);
      });
      return;
    }
    let mounted = true;
    const loadConversation = async () => {
      const supabase = createClient();
      const [{ data: messageData, error: messageError }, { data: attachmentData, error: attachmentError }] = await Promise.all([
        supabase
          .from("support_messages")
          .select(supportMessageSelect)
          .eq("ticket_id", selectedId)
          .eq("is_internal", false)
          .order("created_at", { ascending: true }),
        supabase
          .from("support_attachments")
          .select(supportAttachmentSelect)
          .eq("ticket_id", selectedId)
          .order("created_at", { ascending: true }),
      ]);
      if (!mounted) return;
      if (messageError || attachmentError) {
        setError(supportError(messageError ?? attachmentError));
        return;
      }
      const rows = (attachmentData ?? []) as unknown as SupportAttachmentRow[];
      const linkedFiles = await Promise.all(rows.map(async (attachment) => {
        const { data } = await supabase.storage.from(attachmentBucket).createSignedUrl(attachment.storage_path, 3600);
        return { ...attachment, url: data?.signedUrl ?? "" };
      }));
      if (!mounted) return;
      setMessages((messageData ?? []) as unknown as SupportMessageRow[]);
      setAttachments(linkedFiles);
    };
    void loadConversation();
    return () => { mounted = false; };
  }, [selectedId, user]);

  const selected = useMemo(() => tickets.find((ticket) => ticket.id === selectedId) ?? null, [selectedId, tickets]);

  function chooseFiles(selectedFiles: FileList | null) {
    if (!selectedFiles) return;
    setError("");
    const next = Array.from(selectedFiles);
    if (next.length > maxAttachments) {
      setError(`Add no more than ${maxAttachments} supporting files.`);
      return;
    }
    const invalid = next.find((file) => !acceptedAttachmentTypes.has(file.type) || file.size > maxAttachmentBytes);
    if (invalid) {
      setError(`${invalid.name} must be a PNG, JPG, WebP, or PDF no larger than 5 MB.`);
      return;
    }
    setFiles(next);
  }

  async function uploadAttachments(ticketId: string) {
    if (!user || !files.length) return "";
    const supabase = createClient();
    const failures: string[] = [];

    for (const file of files) {
      const storagePath = `${user.id}/${ticketId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from(attachmentBucket)
        .upload(storagePath, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (uploadError) {
        failures.push(file.name);
        continue;
      }
      const { error: recordError } = await supabase.from("support_attachments").insert({
        ticket_id: ticketId,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: user.id,
      });
      if (recordError) {
        failures.push(file.name);
        await supabase.storage.from(attachmentBucket).remove([storagePath]);
      }
    }

    return failures.length
      ? `The request was created, but ${failures.length} supporting file${failures.length === 1 ? "" : "s"} could not be attached. You can mention this in a reply.`
      : "";
  }

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setAttachmentWarning("");
    try {
      if (requiresReference && !form.orderNumber.trim()) {
        throw new Error("Enter the order or request reference for this support topic.");
      }
      const supabase = createClient();
      const { data, error: submitError } = await supabase.rpc("create_support_ticket", {
        p_type: form.type,
        p_name: form.name,
        p_email: form.email,
        p_phone: form.phone || null,
        p_subject: form.subject,
        p_message: form.message,
        p_order_number: form.orderNumber || null,
      });
      if (submitError) throw submitError;
      const result = Array.isArray(data) ? data[0] : data;
      const ticketId = result && typeof result === "object" && "ticket_id" in result ? String(result.ticket_id) : "";
      const ticketNumber = result && typeof result === "object" && "ticket_number" in result ? String(result.ticket_number) : "";
      if (!ticketId) throw new Error("The support request was created without a usable ticket reference.");
      const uploadWarning = await uploadAttachments(ticketId);
      setAttachmentWarning(uploadWarning);
      setSubmittedTicket({ id: ticketId, number: ticketNumber });
      setForm((current) => ({ ...emptyForm, name: current.name, email: current.email, phone: current.phone }));
      setFiles([]);
      if (user) {
        setSelectedId(ticketId);
        await loadTickets();
      }
    } catch (caught) {
      setError(supportError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setReplying(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: replyError } = await supabase.rpc("add_support_message", {
        p_ticket_id: selected.id,
        p_message: reply.trim(),
      });
      if (replyError) throw replyError;
      setReply("");
      await loadTickets();
      const { data, error: messageError } = await supabase
        .from("support_messages")
        .select(supportMessageSelect)
        .eq("ticket_id", selected.id)
        .eq("is_internal", false)
        .order("created_at", { ascending: true });
      if (messageError) throw messageError;
      setMessages((data ?? []) as unknown as SupportMessageRow[]);
    } catch (caught) {
      setError(supportError(caught));
    } finally {
      setReplying(false);
    }
  }

  function resetRequest() {
    setSubmittedTicket(null);
    setAttachmentWarning("");
    setError("");
    setFiles([]);
  }

  return (
    <main className="support-page">
      <section className="support-hero">
        <div className="site-container support-hero-inner">
          <div>
            <p className="eyebrow">Contact and support</p>
            <h1>Support for every part of your <span className="support-hero-brand" aria-label="khet E">khet <strong>E</strong></span> journey.</h1>
            <p>Contact us about products, orders, payments, delivery, custom requests, farmer or business applications, returns, and replacements.</p>
          </div>
        </div>
      </section>

      <div className="site-container support-layout">
        <section className="support-form-card">
          <header><Headphones /><div><p className="eyebrow">New request</p><h2>How can we help?</h2></div></header>

          {submittedTicket ? (
            <section className="support-success-panel">
              <CheckCircle2 />
              <p className="eyebrow">Support request received</p>
              <h2>We have received your message.</h2>
              <p>The <BrandName /> support team can now review your request. Keep the reference below for future communication.</p>
              <div><small>Ticket reference</small><strong>{submittedTicket.number || submittedTicket.id}</strong></div>
              {attachmentWarning ? <p className="support-alert warning">{attachmentWarning}</p> : null}
              <span>
                {user ? <button className="primary-button" type="button" onClick={() => setSelectedId(submittedTicket.id)}>View conversation <ArrowRight /></button> : <button className="primary-button" type="button" onClick={openLogin}>Sign in to track requests <LogIn /></button>}
                <button className="secondary-button" type="button" onClick={resetRequest}>Send another request</button>
              </span>
            </section>
          ) : (
            <form onSubmit={submitTicket}>
              <section className="support-form-section">
                <div className="support-step-heading"><span>01</span><div><h3>Choose a support topic</h3><p>Select the option that best matches what you need.</p></div></div>
                <div className="support-topic-grid">
                  {supportTopicOptions.map((option) => (
                    <button
                      className={form.type === option.value ? "selected" : ""}
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setForm({ ...form, type: option.value });
                        setError("");
                      }}
                    >
                      <strong>{option.title}</strong>
                      <span>{option.description}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="support-form-section">
                <div className="support-step-heading"><span>02</span><div><h3>Contact information</h3><p>Tell us who the support team should respond to.</p></div></div>
                <div className="form-grid">
                  <label>Full name<input required minLength={2} maxLength={100} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
                  <label>Email address<input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
                  <label className="span-two">Phone number <small>Optional</small><input maxLength={30} autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
                  {requiresReference ? <label className="span-two">Order or request reference<input required maxLength={40} value={form.orderNumber} onChange={(event) => setForm({ ...form, orderNumber: event.target.value })} placeholder="Example: KHE-260723-AB12CD34" /><small>Required for {labelSupportType(form.type).toLowerCase()}.</small></label> : null}
                </div>
              </section>

              <section className="support-form-section">
                <div className="support-step-heading"><span>03</span><div><h3>Your message</h3><p>Include the details needed to understand and review your request.</p></div></div>
                <div className="form-grid">
                  <label className="span-two">Subject<input required minLength={5} maxLength={160} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Briefly describe what you need help with" /></label>
                  <label className="span-two">Message<textarea required minLength={10} maxLength={4000} rows={7} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="Include the important details our support team should know." /></label>
                </div>

                <div className={`support-upload ${user ? "" : "disabled"}`}>
                  <Paperclip />
                  <div><strong>Supporting photos or documents</strong><span>{user ? "Add up to 5 PNG, JPG, WebP, or PDF files. Maximum 5 MB each." : "Sign in before submitting if you want to attach supporting files."}</span></div>
                  {user ? <label><input className="sr-only" type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf" onChange={(event) => chooseFiles(event.target.files)} /><span>Choose files</span></label> : <button type="button" onClick={openLogin}>Sign in</button>}
                </div>

                {files.length ? <div className="support-file-list">{files.map((file) => <span key={`${file.name}-${file.lastModified}`}><FileText /><i><strong>{file.name}</strong><small>{formatSupportFileSize(file.size)}</small></i><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((item) => item !== file))}><X /></button></span>)}</div> : null}
              </section>

              {error ? <p className="support-alert error">{error}</p> : null}
              <button className="primary-button support-submit-button" type="submit" disabled={submitting}>{submitting ? <LoaderCircle className="admin-spinner" /> : <Send />} {submitting ? "Submitting…" : "Submit support request"}</button>
            </form>
          )}
        </section>

        <aside className="support-aside-stack">
          <section className="support-guidance-card support-direct-contact">
            <div className="support-direct-heading"><MessageCircle aria-hidden="true" /><div><p className="eyebrow">Talk with us</p><h2>WhatsApp &amp; phone</h2></div></div>
            <p>Message us on WhatsApp or call {WHATSAPP_NUMBER}. To make a WhatsApp voice call, open the chat and tap its call icon.</p>
            <div className="support-direct-actions">
              <a className="primary-button" href={WHATSAPP_CHAT_URL} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />Message on WhatsApp</a>
              <a className="secondary-button" href={PHONE_CALL_URL}><Phone aria-hidden="true" />Call {WHATSAPP_NUMBER}</a>
            </div>
          </section>
          <section className="support-guidance-card featured"><Headphones /><p className="eyebrow">Central support</p><p>All customer, farmer, business, and partner support is coordinated by <BrandName />. Buyers are not connected directly to sellers through support tickets.</p></section>
          <section className="support-guidance-card"><Clock3 /><p className="eyebrow">Response priorities</p><dl><div><dt>Urgent order issue</dt><dd>Prioritized by the support team</dd></div><div><dt>General support</dt><dd>Reviewed during operating hours</dd></div><div><dt>Custom request</dt><dd>May require availability and feasibility review</dd></div></dl></section>
          <section className="support-guidance-card"><ShieldCheck /><p className="eyebrow">Privacy and safety</p><p>Contact information, payment details, and private customer data are kept inside the support process and are not displayed publicly.</p></section>
          <section className="support-guidance-card"><Store /><p className="eyebrow">Applications and onboarding</p><p>Farmers, independent businesses, experts, and partners can use the application topic for verification and account guidance.</p></section>

          <section className="support-account-card">
            <div className="support-account-heading"><div><p className="eyebrow">Request history</p><h2>My support</h2></div>{user ? <button type="button" onClick={() => void loadTickets()} aria-label="Refresh support requests"><RefreshCw /></button> : null}</div>
            {!authReady || loading ? <div className="support-empty"><LoaderCircle className="admin-spinner" /> Loading support…</div> : null}
            {authReady && !user ? <div className="support-empty"><LogIn /><strong>Track requests after signing in</strong><p>You can submit as a guest. Sign in first if you want request history, replies, and attachments saved in your account.</p><button className="secondary-button" type="button" onClick={openLogin}>Login or register</button></div> : null}
            {user && !loading && !tickets.length ? <div className="support-empty"><PackageSearch /><strong>No support requests yet</strong><p>Your signed-in requests will appear here.</p></div> : null}
            {user && tickets.length ? (
              <div className="support-ticket-list">
                {tickets.map((ticket) => <button className={ticket.id === selectedId ? "selected" : ""} type="button" key={ticket.id} onClick={() => setSelectedId(ticket.id)}><span><strong>{ticket.ticket_number}</strong><small>{ticket.subject}</small></span><i className={`support-status support-status-${ticket.status}`}>{labelSupportStatus(ticket.status)}</i></button>)}
              </div>
            ) : null}
          </section>
        </aside>

        {user && selected ? (
          <section className="support-thread-card">
            <header>
              <div><p className="eyebrow">{selected.ticket_number}</p><h2>{selected.subject}</h2><span>{labelSupportType(selected.type)}{selected.order_number ? ` · ${selected.order_number}` : ""}</span></div>
              <i className={`support-status support-status-${selected.status}`}>{labelSupportStatus(selected.status)}</i>
            </header>
            <div className="support-thread">
              {messages.map((message) => <article className={message.sender_kind === "team" ? "team" : "customer"} key={message.id}><span><strong>{message.sender_kind === "team" ? "khetE Support" : "You"}</strong><small><Clock3 /> {formatSupportDate(message.created_at)}</small></span><p>{message.body}</p></article>)}
            </div>
            {attachments.length ? <div className="support-thread-files"><strong><Paperclip /> Supporting files</strong><div>{attachments.map((attachment) => attachment.url ? <Link href={attachment.url} target="_blank" rel="noopener noreferrer" key={attachment.id}><FileText /><span><b>{attachment.file_name}</b><small>{formatSupportFileSize(attachment.size_bytes)}</small></span></Link> : null)}</div></div> : null}
            {!["closed"].includes(selected.status) ? <div className="support-reply"><label htmlFor="support-reply">Add a reply</label><textarea id="support-reply" rows={4} maxLength={4000} value={reply} onChange={(event) => setReply(event.target.value)} /><button className="primary-button" type="button" disabled={replying || !reply.trim()} onClick={() => void sendReply()}>{replying ? <LoaderCircle className="admin-spinner" /> : <MessageCircle />} {replying ? "Sending…" : "Send reply"}</button></div> : <p className="support-closed-note">This request is closed. Submit a new request if you need more help.</p>}
          </section>
        ) : null}
      </div>
    </main>
  );
}

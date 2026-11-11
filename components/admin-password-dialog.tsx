"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle, MailCheck, X } from "lucide-react";

type Phase = "form" | "sending" | "waiting" | "changing";
type FlowStatus = { state?: "none" | "pending" | "verified"; error?: string; signInAgain?: boolean; changed?: boolean };

async function result(response: Response): Promise<FlowStatus> {
  const body = await response.json() as FlowStatus;
  if (!response.ok) throw new Error(body.error || "The request could not be completed. Please try again.");
  return body;
}

export function AdminPasswordDialog({ email, onChanged }: { email: string; onChanged?: () => void }) {
  const router = useRouter();
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const finishing = useRef(false);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLInputElement>('input[autocomplete="new-password"]')?.focus();
    return () => { document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, [open]);

  useEffect(() => {
    if (!resendSeconds) return;
    const timer = window.setInterval(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  function close() {
    if (phase === "changing" || phase === "sending") return;
    setOpen(false);
    setPassword("");
    setConfirmation("");
    setShowPasswords(false);
    setError("");
    setPhase("form");
    void fetch("/api/admin/password-change/cancel", { method: "POST" }).catch(() => {});
  }

  function trapFocus(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key !== "Tab") return;
    const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]') ?? []);
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  async function sendLink(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (phase === "sending" || phase === "changing") return;
    setError("");
    if (password.length < 8 || password.length > 128) { setError("Use a new password with 8 to 128 characters."); return; }
    if (password !== confirmation) { setError("The new passwords do not match."); return; }
    setPhase("sending");
    try {
      // Passwords remain only in this component's memory until email verification.
      await result(await fetch("/api/admin/password-change/send-link", { method: "POST" }));
      setResendSeconds(60);
      setPhase("waiting");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The verification email could not be sent.");
      setPhase("form");
    }
  }

  useEffect(() => {
    if (!open || phase !== "waiting") return;
    const controller = new AbortController();
    let active = true;
    async function check() {
      let ownsConfirmation = false;
      try {
        const status = await result(await fetch("/api/admin/password-change/status", { cache: "no-store", signal: controller.signal }));
        if (!active || finishing.current) return;
        if (status.state === "none") {
          setError("The email verification request expired or was cancelled. Request a new link.");
          setPhase("form");
          return;
        }
        if (status.state !== "verified") return;
        finishing.current = true;
        ownsConfirmation = true;
        setPhase("changing");
        // This mutation is sent only after the server confirms the one-time link.
        const changed = await result(await fetch("/api/admin/password-change/confirm", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password, confirmation }),
        }));
        if (!changed.changed) throw new Error("The password change could not be confirmed.");
        setPassword("");
        setConfirmation("");
        setOpen(false);
        setPhase("form");
        onChanged?.();
        if (changed.signInAgain) router.replace("/admin/login?passwordChanged=1");
        else router.refresh();
      } catch (caught) {
        if (controller.signal.aborted && !finishing.current) return;
        setError(caught instanceof Error ? caught.message : "The password could not be changed.");
        setPhase("form");
      } finally { if (ownsConfirmation) finishing.current = false; }
    }
    void check();
    const timer = window.setInterval(() => void check(), 2500);
    return () => { active = false; controller.abort(); window.clearInterval(timer); };
  }, [open, phase, password, confirmation, onChanged, router]);

  return <>
    <button className="secondary-button admin-password-trigger" type="button" onClick={() => { setError(""); setOpen(true); }}><KeyRound /> Change password</button>
    {open ? createPortal(<div className="admin-password-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section ref={dialogRef} className="admin-password-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} onKeyDown={trapFocus}>
        <header className="admin-password-dialog-header"><div><p className="eyebrow">Account security</p><h2 id={titleId}>Change password</h2></div><button className="icon-button" type="button" onClick={close} aria-label="Close password change" disabled={phase === "sending" || phase === "changing"}><X /></button></header>
        <p id={descriptionId}>Choose a new password, then verify the one-time link sent to <strong>{email}</strong>. Open it in this browser. Once verified, we’ll save the password and return to your profile.</p>
        <p className="admin-password-identity-note">This sign-in identity shares its password with any marketplace account using the same credentials.</p>
        <form onSubmit={(event) => void sendLink(event)}>
          <div className="admin-password-dialog-fields">
            <label>New password<input type={showPasswords ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={phase !== "form"} /></label>
            <label>Confirm new password<input type={showPasswords ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={phase !== "form"} /></label>
            <label className="admin-password-show"><input type="checkbox" checked={showPasswords} onChange={(event) => setShowPasswords(event.target.checked)} /> Show passwords</label>
          </div>
          {phase === "waiting" ? <div className="admin-password-link-waiting" role="status"><MailCheck /><div><strong>Check your email</strong><p>Open the verification link, then return to this tab. This window checks automatically. The request expires after 15 minutes.</p></div></div> : null}
          {error ? <p className="auth-message auth-error" role="alert">{error}</p> : null}
          <div className="admin-password-dialog-actions">
            {phase === "waiting" ? <button className="secondary-button" type="button" disabled={resendSeconds > 0} onClick={() => void sendLink()}>{resendSeconds ? `Resend in ${resendSeconds}s` : "Resend verification link"}</button> : <button className="primary-button" type="submit" disabled={phase !== "form"}>{phase === "sending" || phase === "changing" ? <><LoaderCircle className="admin-spinner" /> {phase === "changing" ? "Changing password…" : "Sending link…"}</> : "Send verification link"}</button>}
            <button className="secondary-button" type="button" onClick={close} disabled={phase === "sending" || phase === "changing"}>Cancel</button>
          </div>
        </form>
      </section>
    </div>, document.body) : null}
  </>;
}

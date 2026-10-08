"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { ArrowLeft, BadgeCheck, KeyRound, LoaderCircle, Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function VerificationForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const normalizedEmail = email.trim().toLowerCase();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: code.trim(),
      type: "email",
    });
    if (verifyError) {
      setError(verifyError.message);
      setBusy(false);
      return;
    }
    const { error: activationError } = await supabase.rpc("accept_admin_invitation");
    if (activationError) {
      await supabase.auth.signOut();
      setError(activationError.message);
      setBusy(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="admin-login-page admin-verify-page">
      <header className="admin-login-header">
        <Link className="admin-login-wordmark" href="/" aria-label="khetE marketplace"><span className="brand-image" /><small>Administration</small></Link>
        <Link href="/admin/login" className="admin-login-back"><ArrowLeft /> Admin login</Link>
      </header>
      <section className="admin-login-shell">
        <div className="admin-login-intro">
          <p className="eyebrow">Staff invitation</p>
          <h1>Verify your authority before entering khetE Admin.</h1>
          <p>Your selected responsibilities remain inactive until the one-time code sent to your email is verified.</p>
          <div className="admin-login-security"><BadgeCheck /><span><strong>Authority activates after verification</strong><small>Your email, phone number and roles were added by the Super Admin.</small></span></div>
        </div>
        <div className="admin-login-card">
          <KeyRound />
          <p className="eyebrow">Email verification</p>
          <h2>Enter your code</h2>
          <p>Use the one-time code from the invitation email.</p>
          <form onSubmit={verify}>
            <label>Email address<span className="input-with-icon"><Mail /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></span></label>
            <label>Verification code<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Enter code" required /></label>
            {error ? <p className="auth-message auth-error" role="alert">{error}</p> : null}
            <button className="primary-button admin-login-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="admin-spinner" /> Verifying…</> : "Verify and activate authority"}</button>
          </form>
        </div>
      </section>
    </main>
  );
}

export default function AdminVerificationPage() {
  return <Suspense fallback={<main className="admin-login-page"><div className="admin-login-check"><LoaderCircle className="admin-spinner" /> Preparing verification…</div></main>}><VerificationForm /></Suspense>;
}

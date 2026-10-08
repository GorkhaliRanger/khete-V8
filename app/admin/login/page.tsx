"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { hasAdminAccess } from "@/lib/admin-permissions";
import { createClient } from "@/lib/supabase/client";

function safeDestination(value: string | null) {
  return value?.startsWith("/admin") && !value.startsWith("//") ? value : "/admin";
}

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const destination = safeDestination(searchParams.get("next"));

  useEffect(() => {
    let active = true;
    async function checkExistingSession() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data.user) {
        setChecking(false);
        return;
      }
      const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      const roles = (roleRows ?? []).map((row) => String(row.role));
      if (hasAdminAccess(roles)) {
        router.replace(destination);
        return;
      }
      setChecking(false);
      setError("The signed-in account does not have an active khetE administration role.");
    }
    void checkExistingSession();
    return () => { active = false; };
  }, [destination, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError || !data.user) {
      setError(signInError?.message ?? "Admin sign-in could not be completed.");
      setSubmitting(false);
      return;
    }
    const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const roles = (roleRows ?? []).map((row) => String(row.role));
    if (roleError || !hasAdminAccess(roles)) {
      await supabase.auth.signOut();
      setError("This account is valid, but it has not been authorised for khetE administration.");
      setSubmitting(false);
      return;
    }
    router.replace(destination);
    router.refresh();
  }

  return (
    <main className="admin-login-page">
      <header className="admin-login-header">
        <Link className="admin-login-wordmark" href="/" aria-label="khetE marketplace"><span className="brand-image" /><small>Administration</small></Link>
        <Link href="/" className="admin-login-back"><ArrowLeft /> Return to marketplace</Link>
      </header>
      <section className="admin-login-shell">
        <div className="admin-login-intro">
          <p className="eyebrow">Protected administration</p>
          <h1>Manage khetE with the same clear, trusted experience.</h1>
          <p>Every staff member signs in through one secure entrance and receives access only to their assigned operational areas.</p>
          <div className="admin-login-security"><ShieldCheck /><span><strong>Verified role-based access</strong><small>Accounts, listings, promotions, orders, finance, support and content.</small></span></div>
        </div>
        <div className="admin-login-card">
          <LockKeyhole />
          <p className="eyebrow">khetE administration</p>
          <h2>Admin login</h2>
          <p>Use the email and password of an authorised staff account.</p>
          {checking ? <div className="admin-login-check"><LoaderCircle className="admin-spinner" /> Checking current session…</div> : (
            <form onSubmit={submit}>
              <label>Email address<span className="input-with-icon"><Mail /><input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@khete.com" required /></span></label>
              <label>Password<span className="input-with-icon"><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>
              {error ? <p className="auth-message auth-error" role="alert">{error}</p> : null}
              <button className="primary-button admin-login-submit" type="submit" disabled={submitting}>{submitting ? <><LoaderCircle className="admin-spinner" /> Verifying access…</> : "Sign in to Admin"}</button>
            </form>
          )}
          <p className="admin-login-help">Admin registration is disabled. New staff accounts and authority must be approved by the Super Admin.</p>
        </div>
      </section>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="admin-login-page"><section className="admin-login-panel"><div className="admin-login-check"><LoaderCircle className="admin-spinner" /> Preparing secure login…</div></section></main>}>
      <AdminLoginForm />
    </Suspense>
  );
}

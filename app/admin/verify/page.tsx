"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, Eye, EyeOff, KeyRound, LoaderCircle, Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function VerificationForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const googleReturn = params.get("provider") === "google";

  useEffect(() => {
    if (!googleReturn) return;
    let mounted = true;

    async function activateGoogleInvitation() {
      setBusy(true);
      setError("");
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!authData.user) {
        setError("Google sign-in could not be confirmed. Please try again.");
        setBusy(false);
        return;
      }

      const { error: activationError } = await supabase.rpc("accept_admin_invitation");
      if (!mounted) return;
      if (activationError) {
        await supabase.auth.signOut();
        setError(activationError.message);
        setBusy(false);
        return;
      }
      router.replace("/admin");
      router.refresh();
    }

    void activateGoogleInvitation();
    return () => { mounted = false; };
  }, [googleReturn, router]);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Create a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const normalizedEmail = email.trim().toLowerCase();

    if (!verified) {
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
      setVerified(true);
    }

    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) {
      setError(passwordError.message);
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

  async function continueWithGoogle() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("Enter the invited email address before continuing with Google.");
      return;
    }

    setBusy(true);
    setError("");
    const returnPath = `/admin/verify?email=${encodeURIComponent(normalizedEmail)}&provider=google`;
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnPath)}`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setBusy(false);
    }
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
          <h1>Verify your authority and secure your Admin account.</h1>
          <p>Your selected responsibilities remain inactive until the email code is verified and you create a password for future sign-ins.</p>
          <div className="admin-login-security"><BadgeCheck /><span><strong>Authority activates after verification</strong><small>Your email, phone number and roles were added by the Super Admin.</small></span></div>
        </div>
        <div className="admin-login-card">
          <KeyRound />
          <p className="eyebrow">Email verification</p>
          <h2>Activate your account</h2>
          <p>Enter the one-time code and create the password you will use for Admin login.</p>
          <form onSubmit={verify}>
            <label>Email address<span className="input-with-icon"><Mail /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={verified} /></span></label>
            <label>Verification code<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Enter code" required={!verified} disabled={verified} /></label>
            <label>Create password<span className="input-with-icon"><input type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" required minLength={8} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>
            <label>Confirm password<input type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter the same password again" required minLength={8} /></label>
            {error ? <p className="auth-message auth-error" role="alert">{error}</p> : null}
            <button className="primary-button admin-login-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="admin-spinner" /> Activating…</> : "Verify, set password and activate"}</button>
          </form>
          <div className="auth-divider"><span>or</span></div>
          <button className="google-button" type="button" onClick={() => void continueWithGoogle()} disabled={busy}><span>G</span> Activate with Google — no password needed</button>
        </div>
      </section>
    </main>
  );
}

export default function AdminVerificationPage() {
  return <Suspense fallback={<main className="admin-login-page"><div className="admin-login-check"><LoaderCircle className="admin-spinner" /> Preparing verification…</div></main>}><VerificationForm /></Suspense>;
}

"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { ArrowLeft, BadgeCheck, Eye, EyeOff, KeyRound, LoaderCircle, Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { isVerifiedInvitee, readInvitationLink } from "@/lib/admin-invitation-link";
import { createClient } from "@/lib/supabase/admin-client";

function VerificationForm() {
  const router = useRouter();
  const params = useSearchParams();
  const invitedEmail = params.get("email")?.trim().toLowerCase() ?? "";
  const googleReturn = params.get("provider") === "google";
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verified, setVerified] = useState(false);
  const [checkingLink, setCheckingLink] = useState(!googleReturn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // React Strict Mode may rerun this effect after its first invocation removed
  // the fragment. Reuse the same one-time session adoption in that case.
  const firstLink = useRef<ReturnType<typeof readInvitationLink> | null>(null);
  const adoption = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    if (googleReturn) return;
    let mounted = true;

    async function checkEmailLink() {
      // Remove implicit-flow tokens before the client can read the URL.
      const link = firstLink.current ?? readInvitationLink(window.location.href);
      if (!firstLink.current) {
        firstLink.current = link;
        if (link.kind !== "none") window.history.replaceState(window.history.state, "", link.cleanUrl);
      }
      if (link.kind === "invalid") {
        if (mounted) {
          setError("This verification link is invalid or expired. Ask the Super Admin to send a new invitation link.");
          setCheckingLink(false);
        }
        return;
      }

      const hadEmailLink = link.kind === "session" || Boolean(adoption.current);
      if (!hadEmailLink) {
        if (mounted) setCheckingLink(false);
        return;
      }
      const supabase = createClient();
      if (link.kind === "session") {
        // Only the isolated Admin cookie receives the invitee's session.
        adoption.current ??= supabase.auth.setSession({
          access_token: link.accessToken,
          refresh_token: link.refreshToken,
        }).then(({ error }) => !error).catch(() => false);
        firstLink.current = { kind: "none", cleanUrl: link.cleanUrl };
      }
      if (adoption.current) {
        const adopted = await adoption.current;
        if (!adopted) {
          if (mounted) {
            setError("This verification link could not be opened. Ask the Super Admin to send a new invitation link.");
            setCheckingLink(false);
          }
          return;
        }
      }

      const { data: authData, error: userError } = await supabase.auth.getUser();
      if (!mounted) return;
      const user = authData.user;
      const expectedEmail = invitedEmail || user?.email || "";
      if (!userError && isVerifiedInvitee(user, expectedEmail)) {
        setEmail(user?.email ?? expectedEmail);
        setVerified(true);
      } else if (hadEmailLink) {
        await supabase.auth.signOut({ scope: "local" });
        if (!mounted) return;
        setError("This link was opened with a different email address. Ask the Super Admin to resend the invitation.");
      }
      setCheckingLink(false);
    }

    void checkEmailLink();
    return () => { mounted = false; };
  }, [googleReturn, invitedEmail]);

  useEffect(() => {
    if (!googleReturn) return;
    let mounted = true;

    async function activateGoogleInvitation() {
      setBusy(true);
      setError("");
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!isVerifiedInvitee(authData.user, invitedEmail)) {
        setError("Google sign-in must use the invited and verified email address.");
        setBusy(false);
        return;
      }
      const { error: activationError } = await supabase.rpc("accept_admin_invitation");
      if (!mounted) return;
      if (activationError) {
        await supabase.auth.signOut({ scope: "local" });
        setError(activationError.message);
        setBusy(false);
        return;
      }
      router.replace("/admin");
      router.refresh();
    }

    void activateGoogleInvitation();
    return () => { mounted = false; };
  }, [googleReturn, invitedEmail, router]);

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!verified) {
      setError("Open the verification link sent to the invited email address first.");
      return;
    }
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
    const { data: authData, error: userError } = await supabase.auth.getUser();
    if (userError || !isVerifiedInvitee(authData.user, email)) {
      setError("Your verified Admin session expired. Open a fresh invitation link.");
      setBusy(false);
      return;
    }
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) {
      setError(passwordError.message);
      setBusy(false);
      return;
    }
    const { error: activationError } = await supabase.rpc("accept_admin_invitation");
    if (activationError) {
      await supabase.auth.signOut({ scope: "local" });
      setError(activationError.message);
      setBusy(false);
      return;
    }
    setPassword("");
    setConfirmPassword("");
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
    const { error: oauthError } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/admin/auth/callback?next=${encodeURIComponent(returnPath)}` },
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
          <p>Open the one-time email link in this browser, then create your own password for future Admin sign-ins.</p>
          <div className="admin-login-security"><BadgeCheck /><span><strong>Authority activates after verification</strong><small>Your email, phone number and roles were added by a Super Admin.</small></span></div>
        </div>
        <div className="admin-login-card">
          <KeyRound />
          <p className="eyebrow">Email verification</p>
          <h2>Activate your account</h2>
          <p>{verified ? "Email verified. Create the password you will use at Admin login." : "Open the verification link in your email. You can also use Google with the invited email."}</p>
          {checkingLink ? <div className="admin-login-check"><LoaderCircle className="admin-spinner" /> Checking verification link…</div> : null}
          <form onSubmit={activate}>
            <label>Email address<span className="input-with-icon"><Mail /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required readOnly={verified} /></span></label>
            {verified ? <>
              <label>Create password<span className="input-with-icon"><input type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" required minLength={8} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>
              <label>Confirm password<input type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter the same password again" required minLength={8} /></label>
            </> : null}
            {error ? <p className="auth-message auth-error" role="alert">{error}</p> : null}
            {verified ? <button className="primary-button admin-login-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="admin-spinner" /> Activating…</> : "Set password and activate"}</button> : null}
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

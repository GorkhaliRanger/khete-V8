"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { PasswordSettings } from "@/components/password-settings";
import { AdminPasswordLinkReturn } from "@/components/admin-password-link-return";
import { hasFreshAdminEmailRecoveryProof, readAdminRecoveryEntry, type AdminRecoveryEntry } from "@/lib/admin-password-recovery-entry";
import { hasAdminAccess } from "@/lib/admin-permissions";
import { createClient } from "@/lib/supabase/admin-client";

export default function AdminUpdatePasswordPage() {
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState("");
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const recoveryEntryRef = useRef<AdminRecoveryEntry | null>(null);

  useEffect(() => {
    let active = true;
    async function openRecoverySession() {
      // Capture once before removing the fragment; React's development effect
      // replay must not mistake its own URL cleanup for a missing email link.
      if (!recoveryEntryRef.current) recoveryEntryRef.current = readAdminRecoveryEntry(window.location.search, window.location.hash);
      const entry = recoveryEntryRef.current;
      if (entry.kind === "code") {
        setVerificationCode(entry.code);
        setChecking(false);
        return;
      }
      const supabase = createClient();
      if (window.location.hash) {
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
      }
      if (entry.kind !== "implicit") {
        if (active) { setSignedIn(false); setError("Open the one-time password-reset link sent to your administrator email address. A signed-in session alone does not verify a password change."); setChecking(false); }
        return;
      }
      const { error: sessionError } = await supabase.auth.setSession({ access_token: entry.accessToken, refresh_token: entry.refreshToken });
      if (sessionError) {
        if (active) { setError(sessionError.message); setChecking(false); }
        return;
      }
      const { data, error: userError } = await supabase.auth.getUser();
      const { data: claimData, error: claimError } = await supabase.auth.getClaims();
      if (!active) return;
      const verifiedEmailProof = !userError && !claimError && data.user
        && hasFreshAdminEmailRecoveryProof(claimData?.claims, data.user.id, Date.now() / 1000);
      let activeAdmin = false;
      if (verifiedEmailProof && data.user) {
        const [roleResult, profileResult] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", data.user.id),
          supabase.from("admin_profiles").select("is_active").eq("user_id", data.user.id).maybeSingle(),
        ]);
        if (!active) return;
        activeAdmin = !roleResult.error && !profileResult.error && profileResult.data?.is_active === true
          && hasAdminAccess((roleResult.data ?? []).map((row) => String(row.role)));
      }
      setSignedIn(Boolean(verifiedEmailProof && activeAdmin));
      setError(!verifiedEmailProof ? "This session does not contain a recent verified email link. Request a new password-reset email."
        : !activeAdmin ? "An active Admin account is required to use this password-reset page." : "");
      setChecking(false);
    }
    void openRecoverySession();
    return () => { active = false; };
  }, []);

  return (
    <main className="admin-login-page">
      <header className="admin-login-header">
        <Link className="admin-login-wordmark" href="/admin" aria-label="khetE Admin"><span className="brand-image" /><small>Administration</small></Link>
        <Link className="admin-login-back" href="/admin/login">Admin login</Link>
      </header>
      <div className="site-container password-update-page">
        {checking ? <p className="admin-login-check"><LoaderCircle className="admin-spinner" /> Opening Admin recovery session…</p> : verificationCode ? <AdminPasswordLinkReturn code={verificationCode} /> : signedIn ? <div>
          <PasswordSettings realm="admin" title="Reset Admin password" description="Choose the new password for this sign-in identity. If the same credentials are used for the marketplace, its sign-in password changes too." />
          <p><Link className="secondary-button" href="/admin/settings">Return to Admin settings</Link></p>
        </div> : <section className="password-update-card">
          <h1>Open your password-reset email</h1>
          <p>{error || "Use the secure link sent to your administrator email address to set a new password."}</p>
          <Link className="primary-button" href="/admin/login">Return to Admin login</Link>
        </section>}
      </div>
    </main>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createClient as createAdminClient } from "@/lib/supabase/admin-client";

export function PasswordSettings({ title = "Change password", description = "Update the password used for email sign-in.", realm = "customer" }: { title?: string; description?: string; realm?: "customer" | "admin" }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [googleOnly, setGoogleOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let mounted = true;
    const supabase = realm === "admin" ? createAdminClient() : createClient();
    void supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const providers = Array.isArray(data.user?.app_metadata?.providers)
        ? data.user.app_metadata.providers.map(String)
        : (data.user?.identities ?? []).map((identity) => identity.provider);
      setGoogleOnly(providers.includes("google") && !providers.includes("email"));
    });
    return () => { mounted = false; };
  }, [realm]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (newPassword.length < 8) {
      setError("Use a new password with at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    if (currentPassword && currentPassword === newPassword) {
      setError("Choose a new password that is different from the current password.");
      return;
    }

    setBusy(true);
    const supabase = realm === "admin" ? createAdminClient() : createClient();
    const attributes = currentPassword
      ? { password: newPassword, current_password: currentPassword }
      : { password: newPassword };
    const { error: updateError } = await supabase.auth.updateUser(attributes);
    setBusy(false);
    if (updateError) {
      setError(updateError.message === "reauthentication_needed"
        ? "Please sign in again before changing this password."
        : updateError.message);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setNotice(googleOnly ? "A password was added. Google sign-in will continue to work." : "Your password was updated.");
  }

  return (
    <section className="password-settings-card">
      <header><KeyRound /><div><p className="eyebrow">Account security</p><h2>{googleOnly ? "Set an optional password" : title}</h2><p>{googleOnly ? "This account uses Google. Add a password only if you also want email-and-password sign-in." : description}</p></div></header>
      <form onSubmit={submit}>
        <label>Current password <small>Optional for Google or email-code accounts</small><span className="input-with-icon"><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Enter if this account already has a password" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide passwords" : "Show passwords"}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>
        <label>New password<input type={showPassword ? "text" : "password"} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters" required minLength={8} /></label>
        <label>Confirm new password<input type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter the same password again" required minLength={8} /></label>
        {error ? <p className="auth-message auth-error" role="alert">{error}</p> : null}
        {notice ? <p className="auth-message auth-notice" role="status"><CheckCircle2 /> {notice}</p> : null}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="admin-spinner" /> Updating…</> : googleOnly ? "Set password" : "Change password"}</button>
      </form>
    </section>
  );
}

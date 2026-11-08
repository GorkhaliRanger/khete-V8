"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPassword("");
    setConfirmPassword("");
    setComplete(true);
  }

  return (
    <main className="site-container password-update-page">
      <section className="password-update-card">
        {complete ? <>
          <CheckCircle2 />
          <p className="eyebrow">Password updated</p>
          <h1>Your new password is ready.</h1>
          <p>You can now use it for future email-and-password sign-ins.</p>
          <div className="password-update-actions"><Link className="primary-button" href="/account">Return to your profile</Link><Link className="secondary-button" href="/admin">Open Admin</Link></div>
        </> : <>
          <KeyRound />
          <p className="eyebrow">Secure account recovery</p>
          <h1>Create a new password</h1>
          <p>Enter a new password for the account linked to this recovery session.</p>
          <form onSubmit={updatePassword}>
            <label>New password<span className="input-with-icon"><input type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" minLength={8} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>
            <label>Confirm new password<input type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter the same password again" minLength={8} required /></label>
            {error ? <p className="auth-message auth-error" role="alert">{error}</p> : null}
            <button className="primary-button" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="admin-spinner" /> Updating…</> : "Update password"}</button>
          </form>
        </>}
      </section>
    </main>
  );
}

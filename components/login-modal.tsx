"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Mail, X } from "lucide-react";
import { BrandName } from "./brand-name";
import { useMarketplace } from "./marketplace-provider";

export function LoginModal() {
  const { loginOpen, closeLogin, signIn, signUp, signInWithGoogle } = useMarketplace();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!loginOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLogin();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [loginOpen, closeLogin]);

  function changeMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
    setError("");
    setNotice("");
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (mode === "register" && fullName.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (mode === "register" && password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setSubmitting(true);
    const result = mode === "login"
      ? await signIn(email.trim(), password)
      : await signUp(fullName, email.trim(), password);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.message ?? "Authentication could not be completed.");
      return;
    }
    if (result.message) {
      setNotice(result.message);
      setPassword("");
      setConfirmPassword("");
    }
  }

  async function continueWithGoogle() {
    setError("");
    setNotice("");
    setSubmitting(true);
    const result = await signInWithGoogle();
    setSubmitting(false);
    if (!result.ok) setError(result.message ?? "Google login could not be started.");
  }

  if (!loginOpen) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeLogin()}>
      <section className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <button className="modal-close" type="button" onClick={closeLogin} aria-label="Close login"><X /></button>
        <p className="eyebrow">Your page will stay exactly where it is</p>
        <h2 id="login-title">{mode === "login" ? "Welcome back" : <>Create your <BrandName /> account</>}</h2>
        <p className="modal-copy">Sign in to save your wishlist, track orders, manage invoices or open a linked Professional Account.</p>
        <div className="auth-tabs" role="tablist" aria-label="Account options">
          <button className={mode === "login" ? "active" : ""} type="button" onClick={() => changeMode("login")}>Login</button>
          <button className={mode === "register" ? "active" : ""} type="button" onClick={() => changeMode("register")}>Register</button>
        </div>
        <button className="google-button" type="button" onClick={continueWithGoogle} disabled={submitting}><span>G</span> {mode === "register" ? "Register with Google — no password needed" : "Continue with Google"}</button>
        <div className="auth-divider"><span>or continue with email</span></div>
        <form className="auth-form" onSubmit={submitEmail}>
          {mode === "register" ? (
            <label>Full name<input type="text" autoComplete="name" placeholder="Your full name" value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label>
          ) : null}
          <label>Email address<span className="input-with-icon"><Mail size={18} /><input type="email" autoComplete="email" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></span></label>
          <label>{mode === "register" ? "Create password" : "Password"}<span className="input-with-icon"><input type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "register" ? "At least 8 characters" : "Your password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === "register" ? 8 : undefined} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
          {mode === "register" ? <label>Confirm password<input type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Enter the same password again" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} /></label> : null}
          {error ? <p className="auth-message auth-error" role="alert">{error}</p> : null}
          {notice ? <p className="auth-message auth-notice" role="status">{notice}</p> : null}
          <button className="primary-button auth-submit" type="submit" disabled={submitting}>{submitting ? "Please wait…" : mode === "login" ? "Login" : "Create account"}</button>
        </form>
        <p className="legal-note">By continuing, you agree to <BrandName />&apos;s <Link href="/policies/terms">Terms & Conditions</Link> and <Link href="/policies/privacy">Privacy Policy</Link>.</p>
      </section>
    </div>
  );
}

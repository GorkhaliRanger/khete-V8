"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";

export function AdminPasswordLinkReturn({ code }: { code: string }) {
  const started = useRef(false);
  const [state, setState] = useState<"checking" | "verified" | "error">("checking");
  const [error, setError] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Remove the one-use authorization code from the address bar and history.
    window.history.replaceState(window.history.state, "", "/admin/update-password");
    void fetch("/api/admin/password-change/verify", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
    }).then(async (response) => {
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "This email link could not be verified.");
      setState("verified");
    }).catch((caught) => { setError(caught instanceof Error ? caught.message : "This email link could not be verified."); setState("error"); });
  }, [code]);
  return <section className="password-update-card">
    {state === "checking" ? <><LoaderCircle className="admin-spinner" /><h1>Verifying your email…</h1><p>Please keep this tab open while the one-time link is checked.</p></> : state === "verified" ? <><CheckCircle2 /><h1>Email verified</h1><p>Return to the original Profile & Settings tab. Its password popup will finish the change automatically. You can close this tab.</p><p>If the original tab is no longer open, return to your Admin profile and start a new password change.</p></> : <><h1>Verification link unavailable</h1><p role="alert">{error}</p><p>Open the link in the same browser where you requested the password change. If the request expired, start again from your Admin profile.</p></>}
    <Link className="secondary-button" href="/admin/settings">Return to Admin profile</Link>
  </section>;
}

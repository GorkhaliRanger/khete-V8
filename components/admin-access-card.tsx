"use client";

import Link from "next/link";
import { LoaderCircle, LogIn, RefreshCw, ShieldX } from "lucide-react";

export type AdminAccessState = "loading" | "signed-out" | "denied" | "allowed" | "error";

type AdminAccessCardProps = {
  access: AdminAccessState;
  error?: string;
  email?: string;
  roles?: string[];
  origin?: string;
  resource: string;
  requirement?: string;
  returnTo?: string;
};

const roleLabel: Record<string, string> = {
  customer: "Customer",
  super_admin: "Super Admin",
  product_inventory_manager: "Product & Inventory Manager",
  order_delivery_manager: "Order & Delivery Manager",
  customer_support: "Customer Support",
  finance_manager: "Finance Manager",
  content_promotion_manager: "Content & Promotion Manager",
};

export function AdminAccessCard({ access, error, email, roles = [], origin, resource, requirement = "the Super Admin or Product & Inventory Manager role", returnTo }: AdminAccessCardProps) {
  const loading = access === "loading";
  const signedOut = access === "signed-out";
  const denied = access === "denied";
  const accountHref = `/admin/login?next=${encodeURIComponent(returnTo || "/admin")}`;
  const heading = loading
    ? "Checking admin access…"
    : signedOut
      ? "Admin sign-in required"
      : denied
        ? `This account cannot manage ${resource}`
        : "Admin workspace unavailable";

  return (
    <main className="admin-access-page">
      <div className="admin-access-card">
        {loading ? <LoaderCircle className="admin-spinner" /> : <ShieldX />}
        <p className="eyebrow">Protected administration</p>
        <h1>{heading}</h1>
        {signedOut ? <p>No active sign-in was found on this exact local address. Sign in again here, then reopen the admin page.</p> : null}
        {denied ? <p>This workspace requires {requirement}.</p> : null}
        {access === "error" ? <p>{error || "The role check could not be completed."}</p> : null}
        {loading ? <p>Please wait while the current account and roles are verified.</p> : null}

        {!loading ? (
          <div className="admin-access-diagnostics">
            {email ? <div><span>Signed-in account</span><strong>{email}</strong></div> : null}
            {roles.length ? <div><span>Detected roles</span><strong>{roles.map((role) => roleLabel[role] ?? role).join(", ")}</strong></div> : null}
            {origin ? <div><span>Current address</span><code>{origin}</code></div> : null}
          </div>
        ) : null}

        {!loading ? <p className="admin-origin-note">Browser sessions are separate for <code>localhost:3000</code> and <code>localhost:3001</code>. Use the same address where you signed in, or sign in again after the port changes.</p> : null}
        {!loading ? <div className="admin-access-actions"><Link className="primary-button" href={accountHref}><LogIn size={17} /> Open admin login</Link><button className="secondary-button" type="button" onClick={() => window.location.reload()}><RefreshCw size={17} /> Check again</button></div> : null}
      </div>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock3, LoaderCircle, MailPlus, Phone, RefreshCw, Save, Search, Send, ShieldCheck, UserCog, UsersRound } from "lucide-react";
import { AdminAccessCard, type AdminAccessState } from "@/components/admin-access-card";
import { AdminSidebar } from "@/components/admin-sidebar";
import { ADMIN_ROLES, ADMIN_ROLE_DETAILS, type AdminRole } from "@/lib/admin-permissions";
import { createClient } from "@/lib/supabase/client";

type StaffAccount = {
  user_id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  roles: string[];
  created_at: string;
};

type PendingInvitation = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  roles: string[];
  status: string;
  expires_at: string;
  created_at: string;
};

export default function AdminUsersPage() {
  const [access, setAccess] = useState<AdminAccessState>("loading");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [origin] = useState(() => typeof window === "undefined" ? "" : window.location.origin);
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRoles, setInviteRoles] = useState<AdminRole[]>([]);
  const [inviting, setInviting] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [draftRoles, setDraftRoles] = useState<AdminRole[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setAccess("signed-out");
      setLoading(false);
      return;
    }
    setEmail(authData.user.email ?? "");
    const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", authData.user.id);
    const currentRoles = (roleRows ?? []).map((row) => String(row.role));
    setRoles(currentRoles);
    if (roleError) {
      setAccess("error");
      setError(roleError.message);
      setLoading(false);
      return;
    }
    if (!currentRoles.includes("super_admin")) {
      setAccess("denied");
      setLoading(false);
      return;
    }
    setAccess("allowed");
    const { data, error: directoryError } = await supabase.rpc("admin_user_directory");
    if (directoryError) {
      setError(directoryError.message);
    } else {
      const next = (data ?? []) as StaffAccount[];
      setAccounts(next);
      setSelectedId((current) => {
        if (current) return current;
        const first = next[0];
        if (first) setDraftRoles(first.roles.filter((role): role is AdminRole => (ADMIN_ROLES as readonly string[]).includes(role)));
        return first?.user_id || "";
      });
    }
    const { data: invitationRows, error: invitationError } = await supabase.rpc("admin_invitation_directory");
    if (invitationError) setError((current) => current || invitationError.message);
    else setInvitations((invitationRows ?? []) as PendingInvitation[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selected = accounts.find((account) => account.user_id === selectedId);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return accounts;
    return accounts.filter((account) => `${account.full_name} ${account.email}`.toLowerCase().includes(term));
  }, [accounts, query]);

  function toggleRole(role: AdminRole) {
    setDraftRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
  }

  function selectAccount(account: StaffAccount) {
    setSelectedId(account.user_id);
    setDraftRoles(account.roles.filter((role): role is AdminRole => (ADMIN_ROLES as readonly string[]).includes(role)));
    setNotice("");
    setError("");
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    setError("");
    setNotice("");
    const supabase = createClient();
    const { error: saveError } = await supabase.rpc("set_admin_roles", {
      target_user_id: selected.user_id,
      requested_roles: draftRoles,
    });
    if (saveError) setError(saveError.message);
    else {
      setNotice(`Authority updated for ${selected.full_name || selected.email}.`);
      await load();
    }
    setSaving(false);
  }

  function toggleInviteRole(role: AdminRole) {
    setInviteRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
  }

  async function sendInvitation() {
    if (!inviteName.trim() || !inviteEmail.trim() || !invitePhone.trim() || !inviteRoles.length) {
      setError("Add the staff member’s name, email, phone number, and at least one role.");
      return;
    }
    setInviting(true);
    setError("");
    setNotice("");
    const supabase = createClient();
    const normalizedEmail = inviteEmail.trim().toLowerCase();
    const { error: createError } = await supabase.rpc("create_admin_invitation", {
      invited_email: normalizedEmail,
      invited_full_name: inviteName.trim(),
      invited_phone: invitePhone.trim(),
      requested_roles: inviteRoles,
    });
    if (createError) {
      setError(createError.message);
      setInviting(false);
      return;
    }
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/admin/verify?email=${encodeURIComponent(normalizedEmail)}`,
      },
    });
    if (otpError) {
      setError(`The invitation was saved, but the email code could not be sent: ${otpError.message}`);
    } else {
      setNotice(`Verification code sent to ${normalizedEmail}. Authority remains inactive until the code is verified.`);
      setInviteName("");
      setInviteEmail("");
      setInvitePhone("");
      setInviteRoles([]);
    }
    await load();
    setInviting(false);
  }

  if (access !== "allowed") {
    return <AdminAccessCard access={access} email={email} roles={roles} origin={origin} resource="admin users and authority" error={error} requirement="the Super Admin role" returnTo="/admin/users" />;
  }

  return (
    <main className="admin-shell admin-users-page">
      <AdminSidebar active="users" roles={roles} />
      <section className="admin-main">
        <header className="admin-page-heading">
          <div><p className="eyebrow">Security & team access</p><h1>Admin users & authority</h1><p>Invite staff using email and phone number, then activate only the operational authority they verify.</p></div>
          <button className="secondary-button" type="button" onClick={() => void load()} disabled={loading}><RefreshCw /> Refresh</button>
        </header>

        <section className="admin-invite-card">
          <header><MailPlus /><div><p className="eyebrow">New administrator</p><h2>Invite staff and assign authority</h2><p>The selected roles stay pending until the recipient verifies the one-time code sent to their email.</p></div></header>
          <div className="admin-invite-fields">
            <label>Full name<input value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="Staff member’s name" /></label>
            <label>Email address<input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@example.com" /></label>
            <label>Phone number<span className="input-with-icon"><Phone /><input type="tel" value={invitePhone} onChange={(event) => setInvitePhone(event.target.value)} placeholder="+977 98XXXXXXXX" /></span></label>
          </div>
          <div className="admin-invite-roles">
            <p>Select one or more areas of authority</p>
            <div>{ADMIN_ROLES.map((role) => {
              const detail = ADMIN_ROLE_DETAILS[role];
              const checked = inviteRoles.includes(role);
              return <button className={checked ? "selected" : ""} type="button" key={role} onClick={() => toggleInviteRole(role)} aria-pressed={checked}><span>{checked ? <Check /> : null}</span><strong>{detail.label}</strong><small>{detail.areas.slice(0, 3).join(" • ")}</small></button>;
            })}</div>
          </div>
          {error ? <p className="auth-message auth-error" role="alert">{error}</p> : null}
          {notice ? <p className="auth-message auth-notice" role="status">{notice}</p> : null}
          <footer><p><ShieldCheck /> No role becomes active before email verification.</p><button className="primary-button" type="button" onClick={() => void sendInvitation()} disabled={inviting}>{inviting ? <LoaderCircle className="admin-spinner" /> : <Send />} Send verification code</button></footer>
        </section>

        {invitations.length ? <section className="admin-pending-invitations">
          <header><div><p className="eyebrow">Awaiting confirmation</p><h2>Pending invitations</h2></div><span>{invitations.length}</span></header>
          <div>{invitations.map((invitation) => <article key={invitation.id}>
            <Clock3 />
            <div><strong>{invitation.full_name}</strong><span>{invitation.email} · {invitation.phone}</span><small>{invitation.roles.map((role) => ADMIN_ROLE_DETAILS[role as AdminRole]?.label ?? role).join(" • ")}</small></div>
            <em>Pending verification</em>
          </article>)}</div>
        </section> : null}

        <div className="admin-authority-layout">
          <aside className="admin-authority-users">
            <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" /></label>
            <div>
              {filtered.map((account) => (
                <button className={account.user_id === selectedId ? "selected" : ""} type="button" key={account.user_id} onClick={() => selectAccount(account)}>
                  <span><strong>{account.full_name || "Unnamed account"}</strong><small>{account.email}</small></span>
                  <em>{account.roles.filter((role) => (ADMIN_ROLES as readonly string[]).includes(role)).length} roles</em>
                </button>
              ))}
              {!filtered.length ? <p>No matching account.</p> : null}
            </div>
          </aside>

          <section className="admin-authority-editor">
            {selected ? <>
              <header><UserCog /><div><p className="eyebrow">Selected staff account</p><h2>{selected.full_name || selected.email}</h2><span>{selected.email}</span></div></header>
              <div className="admin-role-grid">
                {ADMIN_ROLES.map((role) => {
                  const detail = ADMIN_ROLE_DETAILS[role];
                  const checked = draftRoles.includes(role);
                  return <button className={checked ? "selected" : ""} type="button" key={role} onClick={() => toggleRole(role)} aria-pressed={checked}>
                    <span className="admin-role-check">{checked ? <Check /> : null}</span>
                    <span><strong>{detail.label}</strong><small>{detail.description}</small><em>{detail.areas.join(" • ")}</em></span>
                  </button>;
                })}
              </div>
              <div className="admin-authority-actions"><p><ShieldCheck /> Changes apply the next time this user opens an admin page.</p><button className="primary-button" type="button" onClick={() => void save()} disabled={saving}>{saving ? <LoaderCircle className="admin-spinner" /> : <Save />} Save authority</button></div>
            </> : <div className="admin-authority-empty"><UsersRound /><h2>Select an account</h2><p>Choose a registered khetE account to assign administration authority.</p></div>}
          </section>
        </div>
      </section>
    </main>
  );
}

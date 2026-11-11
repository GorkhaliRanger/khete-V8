"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock3,
  KeyRound,
  LoaderCircle,
  MailPlus,
  Phone,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  UserX,
  UsersRound,
} from "lucide-react";
import { AdminAccessCard, type AdminAccessState } from "@/components/admin-access-card";
import { AdminSidebar } from "@/components/admin-sidebar";
import {
  ADMIN_ROLE_DETAILS,
  MANAGEABLE_ADMIN_ROLES,
  adminRoleCaption,
  adminRoleLabels,
  type AdminRole,
  type ManageableAdminRole,
} from "@/lib/admin-permissions";
import { createClient } from "@/lib/supabase/admin-client";

type StaffAccount = {
  user_id: string;
  email: string;
  full_name: string;
  phone: string;
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

type Action = "save" | "reset" | "delete" | "promote" | "";

function manageableRoles(roles: readonly string[]) {
  return roles.filter((role): role is ManageableAdminRole => (MANAGEABLE_ADMIN_ROLES as readonly string[]).includes(role));
}

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
  const [inviteRoles, setInviteRoles] = useState<ManageableAdminRole[]>([]);
  const [inviting, setInviting] = useState(false);
  const [resendingEmail, setResendingEmail] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [draftActive, setDraftActive] = useState(true);
  const [draftRoles, setDraftRoles] = useState<ManageableAdminRole[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<Action>("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const populateDraft = useCallback((account?: StaffAccount) => {
    setDraftName(account?.full_name ?? "");
    setDraftPhone(account?.phone ?? "");
    setDraftActive(account?.is_active ?? true);
    setDraftRoles(manageableRoles(account?.roles ?? []));
  }, []);

  const load = useCallback(async (preferredId?: string) => {
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
      const nextSelected = next.find((account) => account.user_id === preferredId) ?? next[0];
      setAccounts(next);
      setSelectedId(nextSelected?.user_id ?? "");
      populateDraft(nextSelected);
    }

    const { data: invitationRows, error: invitationError } = await supabase.rpc("admin_invitation_directory");
    if (invitationError) setError((current) => current || invitationError.message);
    else setInvitations((invitationRows ?? []) as PendingInvitation[]);
    setLoading(false);
  }, [populateDraft]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selected = accounts.find((account) => account.user_id === selectedId);
  const protectedAccount = Boolean(selected?.roles.includes("super_admin"));

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return accounts;
    return accounts.filter((account) => `${account.full_name} ${account.email} ${account.phone} ${adminRoleLabels(account.roles).join(" ")}`.toLowerCase().includes(term));
  }, [accounts, query]);

  function toggleRole(role: ManageableAdminRole) {
    if (protectedAccount || role === "super_admin") return;
    setDraftRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
  }

  function selectAccount(account: StaffAccount) {
    setSelectedId(account.user_id);
    populateDraft(account);
    setNotice("");
    setError("");
  }

  async function save() {
    if (!selected || protectedAccount) return;
    if (draftName.trim().length < 2) {
      setError("Enter the administrator’s full name.");
      return;
    }
    if (!draftRoles.length) {
      setError("Select at least one administration role.");
      return;
    }

    setAction("save");
    setError("");
    setNotice("");
    const supabase = createClient();
    const { error: saveError } = await supabase.rpc("update_admin_account", {
      target_user_id: selected.user_id,
      requested_full_name: draftName.trim(),
      requested_phone: draftPhone.trim(),
      requested_is_active: draftActive,
      requested_roles: draftRoles,
    });
    if (saveError) setError(saveError.message);
    else {
      setNotice(`Profile and authority updated for ${draftName.trim()}.`);
      await load(selected.user_id);
    }
    setAction("");
  }

  async function requestPasswordReset() {
    if (!selected || protectedAccount) return;
    setAction("reset");
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/users/${selected.user_id}/password-reset`, { method: "POST" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The password reset could not be sent.");
      setNotice(`A secure password-reset link was sent to ${selected.email}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The password reset could not be sent.");
    } finally {
      setAction("");
    }
  }

  async function promoteToSuperAdmin() {
    if (!selected || protectedAccount || !selected.is_active) return;
    if (!window.confirm(`Give ${selected.full_name || selected.email} full Super Admin access? This grants authority over the entire Admin panel and existing Super Admin accounts cannot be demoted here.`)) return;
    setAction("promote");
    setError("");
    setNotice("");
    try {
      const { error: promoteError } = await createClient().rpc("grant_super_admin", { target_user_id: selected.user_id });
      if (promoteError) throw promoteError;
      setNotice(`${selected.full_name || selected.email} now has Super Admin authority.`);
      await load(selected.user_id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Super Admin authority could not be assigned.");
    } finally {
      setAction("");
    }
  }

  async function deleteAccount() {
    if (!selected || protectedAccount) return;
    const confirmed = window.confirm(`Delete the Admin profile and authority for ${selected.full_name || selected.email}? Their customer account and orders will remain unchanged.`);
    if (!confirmed) return;

    setAction("delete");
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/users/${selected.user_id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The administrator could not be deleted.");
      setNotice(`Admin access was removed for ${selected.full_name || selected.email}.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The administrator could not be deleted.");
    } finally {
      setAction("");
    }
  }

  function toggleInviteRole(role: ManageableAdminRole) {
    setInviteRoles((current) => role === "super_admin"
      ? (current.includes(role) ? [] : [role])
      : (current.includes(role) ? current.filter((item) => item !== role) : [...current.filter((item) => item !== "super_admin"), role]));
  }

  async function emailInvitationLink(address: string) {
    const response = await fetch("/api/admin/users/send-invitation-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: address }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "The activation email could not be sent.");
  }

  async function resendInvitation(address: string) {
    setResendingEmail(address);
    setError("");
    setNotice("");
    try {
      await emailInvitationLink(address);
      setNotice(`A fresh activation link was sent to ${address}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The activation email could not be sent.");
    } finally {
      setResendingEmail("");
    }
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
    try {
      await emailInvitationLink(normalizedEmail);
      setNotice(`Activation link sent to ${normalizedEmail}. The recipient creates their own password after opening it, then signs in at /admin/login.`);
      setInviteName("");
      setInviteEmail("");
      setInvitePhone("");
      setInviteRoles([]);
    } catch (caught) {
      setError(`The invitation was saved, but the activation link could not be sent: ${caught instanceof Error ? caught.message : "Try Resend activation link below."}`);
    }
    await load(selectedId);
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
          <div><p className="eyebrow">Security & team access</p><h1>Admin users & authority</h1><p>Super Admins can invite staff, assign departments or additional Super Admins, and manage other administrator accounts.</p></div>
          <button className="secondary-button" type="button" onClick={() => void load(selectedId)} disabled={loading}><RefreshCw /> Refresh</button>
        </header>

        {error ? <p className="admin-notice admin-error-notice" role="alert">{error}</p> : null}
        {notice ? <p className="admin-notice admin-success-notice" role="status">{notice}</p> : null}

        <section className="admin-invite-card">
          <header><MailPlus /><div><p className="eyebrow">New administrator</p><h2>Invite staff and assign authority</h2><p>The recipient opens an email verification link and creates their own password before access activates. Passwords are never shown to other administrators.</p></div></header>
          <div className="admin-invite-fields">
            <label>Full name<input value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="Staff member’s name" /></label>
            <label>Email address<input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@example.com" /></label>
            <label>Phone number<span className="input-with-icon"><Phone /><input type="tel" value={invitePhone} onChange={(event) => setInvitePhone(event.target.value)} placeholder="+977 98XXXXXXXX" /></span></label>
          </div>
          <div className="admin-invite-roles">
            <p>Select one or more areas of authority</p>
            <div>{MANAGEABLE_ADMIN_ROLES.map((role) => {
              const detail = ADMIN_ROLE_DETAILS[role];
              const checked = inviteRoles.includes(role);
              return <button className={checked ? "selected" : ""} type="button" key={role} onClick={() => toggleInviteRole(role)} aria-pressed={checked}><span>{checked ? <Check /> : null}</span><strong>{detail.label}</strong><small>{detail.areas.slice(0, 3).join(" • ")}</small></button>;
            })}</div>
          </div>
          <footer><p><ShieldCheck /> Super Admin grants full panel access. Select it alone.</p><button className="primary-button" type="button" onClick={() => void sendInvitation()} disabled={inviting}>{inviting ? <LoaderCircle className="admin-spinner" /> : <Send />} Send activation link</button></footer>
        </section>

        {invitations.length ? <section className="admin-pending-invitations">
          <header><div><p className="eyebrow">Awaiting confirmation</p><h2>Pending invitations</h2></div><span>{invitations.length}</span></header>
          <div>{invitations.map((invitation) => <article key={invitation.id}>
            <Clock3 />
            <div><strong>{invitation.full_name}</strong><span>{invitation.email} · {invitation.phone}</span><small>{invitation.roles.map((role) => ADMIN_ROLE_DETAILS[role as AdminRole]?.label ?? role).join(" • ")}</small></div>
            <div className="admin-invitation-actions"><em>Pending verification</em><button className="secondary-button" type="button" onClick={() => void resendInvitation(invitation.email)} disabled={Boolean(resendingEmail) || inviting}>{resendingEmail === invitation.email ? <LoaderCircle className="admin-spinner" /> : <Send />} Resend link</button></div>
          </article>)}</div>
        </section> : null}

        <div className="admin-authority-layout">
          <aside className="admin-authority-users">
            <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search admin profiles" /></label>
            <div>
              {filtered.map((account) => (
                <button className={account.user_id === selectedId ? "selected" : ""} type="button" key={account.user_id} onClick={() => selectAccount(account)}>
                  <span><strong>{account.full_name || "Unnamed account"}</strong><small>{account.email}</small></span>
                  <em title={adminRoleLabels(account.roles).join(" • ")}>{account.is_active ? adminRoleCaption(account.roles) : "Inactive"}</em>
                </button>
              ))}
              {!filtered.length ? <p>{loading ? "Loading administrator profiles…" : error && !accounts.length ? "Administrator profiles could not be loaded. Use Refresh to try again." : "No matching administrator."}</p> : null}
            </div>
          </aside>

          <section className="admin-authority-editor">
            {selected ? <>
              <header><UserCog /><div><p className="eyebrow">Selected administrator profile</p><h2>{selected.full_name || selected.email}</h2><span>{selected.email}</span></div></header>

              {protectedAccount ? <div className="admin-protected-account"><ShieldCheck /><span><strong>Super Admin · Full administration access</strong><p>Super Admins control every area of the Admin panel, including administrator profiles and authority. Existing Super Admin accounts cannot be edited, deleted, demoted or sent a password reset from this page. Their owners can update their own details in Profile & settings.</p></span></div> : <>
                <div className="admin-profile-fields">
                  <label>Full name<input value={draftName} onChange={(event) => setDraftName(event.target.value)} /></label>
                  <label>Email address<input value={selected.email} readOnly aria-readonly="true" /></label>
                  <label>Phone number<input type="tel" value={draftPhone} onChange={(event) => setDraftPhone(event.target.value)} /></label>
                  <label className="admin-active-control">
                    <span>{draftActive ? <UserCheck /> : <UserX />}<strong>{draftActive ? "Active administrator" : "Administrator deactivated"}</strong></span>
                    <input type="checkbox" checked={draftActive} onChange={(event) => setDraftActive(event.target.checked)} />
                  </label>
                </div>

                <div className="admin-role-grid">
                  {MANAGEABLE_ADMIN_ROLES.filter((role) => role !== "super_admin").map((role) => {
                    const detail = ADMIN_ROLE_DETAILS[role];
                    const checked = draftRoles.includes(role);
                    return <button className={checked ? "selected" : ""} type="button" key={role} onClick={() => toggleRole(role)} aria-pressed={checked}>
                      <span className="admin-role-check">{checked ? <Check /> : null}</span>
                      <span><strong>{detail.label}</strong><small>{detail.description}</small><em>{detail.areas.join(" • ")}</em></span>
                    </button>;
                  })}
                </div>

                <div className="admin-account-management-actions">
                  <button className="secondary-button" type="button" onClick={() => void requestPasswordReset()} disabled={Boolean(action)}>{action === "reset" ? <LoaderCircle className="admin-spinner" /> : <KeyRound />} Send password reset</button>
                  <button className="secondary-button" type="button" onClick={() => void promoteToSuperAdmin()} disabled={Boolean(action) || !selected.is_active} title={selected.is_active ? "Grant full Admin panel authority" : "Activate this administrator before promotion"}>{action === "promote" ? <LoaderCircle className="admin-spinner" /> : <ShieldCheck />} Promote to Super Admin</button>
                  <button className="danger-button" type="button" onClick={() => void deleteAccount()} disabled={Boolean(action)}>{action === "delete" ? <LoaderCircle className="admin-spinner" /> : <Trash2 />} Delete administrator</button>
                </div>
                <div className="admin-authority-actions"><p><ShieldCheck /> Permissions are enforced by the database as well as the interface.</p><button className="primary-button" type="button" onClick={() => void save()} disabled={Boolean(action)}>{action === "save" ? <LoaderCircle className="admin-spinner" /> : <Save />} Save profile & authority</button></div>
              </>}
            </> : <div className="admin-authority-empty"><UsersRound /><h2>Select an account</h2><p>Choose an administrator profile to review or update.</p></div>}
          </section>
        </div>
      </section>
    </main>
  );
}

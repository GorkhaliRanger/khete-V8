"use client";

/* eslint-disable @next/next/no-img-element -- the avatar is a user-managed Supabase image. */

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, LoaderCircle, Pencil, RefreshCw, Save, ShieldCheck, Trash2, X } from "lucide-react";
import { AdminAccessCard, type AdminAccessState } from "@/components/admin-access-card";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminPasswordDialog } from "@/components/admin-password-dialog";
import { useAdminProfilePhoto } from "@/components/use-admin-profile-photo";
import { adminRoleLabels, hasAdminAccess } from "@/lib/admin-permissions";
import { adminSettingsReturnPath } from "@/lib/admin-settings-navigation";
import { createClient } from "@/lib/supabase/admin-client";

const avatarBucket = "admin-profile-images";
type ProfileField = "full_name" | "phone";

function inlineAvatar(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The profile image could not be read."));
    reader.readAsDataURL(blob);
  });
}

async function prepareAvatar(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Choose a valid JPG, PNG or WebP image."));
    element.src = dataUrl;
  });
  const side = Math.min(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  canvas.getContext("2d")?.drawImage(
    image,
    (image.width - side) / 2,
    (image.height - side) / 2,
    side,
    side,
    0,
    0,
    512,
    512,
  );
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The image could not be prepared.")), "image/webp", 0.86);
  });
}

function storedAvatarPath(url: string | null) {
  if (!url) return null;
  try {
    const marker = `/storage/v1/object/public/${avatarBucket}/`;
    const pathname = new URL(url).pathname;
    const index = pathname.indexOf(marker);
    return index >= 0 ? decodeURIComponent(pathname.slice(index + marker.length)) : null;
  } catch {
    return null;
  }
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [access, setAccess] = useState<AdminAccessState>("loading");
  const [origin] = useState(() => typeof window === "undefined" ? "" : window.location.origin);
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileReady, setProfileReady] = useState(false);
  const [editingField, setEditingField] = useState<ProfileField | null>(null);
  const [draft, setDraft] = useState("");
  const { photo: avatarUrl, savePhoto } = useAdminProfilePhoto(userId);
  const [busy, setBusy] = useState<"profile" | "avatar" | "remove-avatar" | "">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    setProfileReady(false);
    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      setAccess("error");
      setError(authError.message);
      return;
    }
    if (!authData.user) {
      setAccess("signed-out");
      return;
    }

    setUserId(authData.user.id);
    setEmail(authData.user.email ?? "");
    const [profileResult, roleResult] = await Promise.all([
      supabase.from("admin_profiles").select("full_name,phone,avatar_url").eq("user_id", authData.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", authData.user.id),
    ]);
    if (roleResult.error) {
      setAccess("error");
      setError(roleResult.error.message);
      return;
    }

    const detectedRoles = (roleResult.data ?? []).map((row) => String(row.role));
    setRoles(detectedRoles);
    if (!hasAdminAccess(detectedRoles)) {
      setAccess("denied");
      return;
    }
    if (profileResult.error) {
      const missingProfileTable = ["PGRST205", "42P01"].includes(profileResult.error.code)
        && profileResult.error.message.includes("admin_profiles");
      if (!missingProfileTable) {
        setAccess("error");
        setError(profileResult.error.message);
        return;
      }
      // Keep the verified Admin signed in. A missing profile table is a setup
      // problem, not a reason to send the user back through authentication.
      setAccess("allowed");
      return;
    }
    setFullName(String(profileResult.data?.full_name || ""));
    setPhone(String(profileResult.data?.phone || ""));
    setProfileReady(Boolean(profileResult.data));
    setAccess("allowed");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function announceUpdate() {
    window.dispatchEvent(new Event("khete-admin-profile-updated"));
  }

  function closeSettings() {
    const returnTo = new URLSearchParams(window.location.search).get("returnTo");
    router.replace(adminSettingsReturnPath(returnTo, window.location.origin));
  }

  function editProfile(field: ProfileField) {
    setDraft(field === "full_name" ? fullName : phone);
    setEditingField(field);
    setError("");
    setNotice("");
  }

  async function saveProfile(field: ProfileField) {
    if (!userId || !profileReady || busy) return;
    const value = draft.trim();
    if (field === "full_name" && value.length < 2) {
      setError("Enter your full name.");
      return;
    }
    setBusy("profile");
    setError("");
    setNotice("");
    try {
      const changes = field === "full_name" ? { full_name: value } : { phone: value || null };
      const { data, error: profileError } = await createClient().from("admin_profiles")
        .update(changes).eq("user_id", userId).select("full_name,phone").single();
      if (profileError) throw profileError;
      setFullName(String(data.full_name || ""));
      setPhone(String(data.phone || ""));
      setEditingField(null);
      setDraft("");
      setNotice(field === "full_name" ? "Admin name updated." : "Admin mobile number updated.");
      announceUpdate();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Admin profile could not be updated. Please try again.");
    } finally {
      setBusy("");
    }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !profileReady || busy) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Choose an image smaller than 8 MB.");
      return;
    }

    setBusy("avatar");
    setError("");
    setNotice("");
    try {
      const blob = await prepareAvatar(file);
      if (blob.size > 2 * 1024 * 1024) throw new Error("The prepared image is larger than 2 MB.");
      const supabase = createClient();
      const storagePath = `${userId}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage.from(avatarBucket).upload(storagePath, blob, {
        cacheControl: "3600",
        contentType: "image/webp",
        upsert: false,
      });
      if (uploadError) {
        // Small avatars can still be saved in the existing profile when the
        // optional Storage bucket has not been installed yet.
        if (uploadError.message.toLowerCase().includes("bucket not found")) {
          await savePhoto(await inlineAvatar(blob));
          setNotice("Profile image updated.");
          announceUpdate();
          return;
        }
        throw uploadError;
      }

      const publicUrl = supabase.storage.from(avatarBucket).getPublicUrl(storagePath).data.publicUrl;
      const nextUrl = `${publicUrl}?v=${Date.now()}`;
      await savePhoto(nextUrl);

      const previousPath = storedAvatarPath(avatarUrl);
      if (previousPath) await supabase.storage.from(avatarBucket).remove([previousPath]);
      setNotice("Profile image updated.");
      announceUpdate();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The profile image could not be uploaded.");
    } finally {
      setBusy("");
    }
  }

  async function removeAvatar() {
    if (!userId || !avatarUrl || !profileReady || busy) return;
    setBusy("remove-avatar");
    setError("");
    setNotice("");
    const supabase = createClient();
    try {
      await savePhoto(null);
      const previousPath = storedAvatarPath(avatarUrl);
      if (previousPath) await supabase.storage.from(avatarBucket).remove([previousPath]);
      setNotice("Profile image removed.");
      announceUpdate();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The profile image could not be removed.");
    }
    setBusy("");
  }

  if (access !== "allowed") {
    return <AdminAccessCard access={access} email={email} roles={roles} origin={origin} resource="Admin profile settings" error={error} requirement="an active khetE administration role" returnTo="/admin/settings" />;
  }

  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "A";

  return (
    <main className="admin-shell admin-settings-page">
      <AdminSidebar active="settings" roles={roles} />
      <section className="admin-main">
        <header className="admin-page-heading admin-settings-heading">
          <div><p className="eyebrow">Signed-in administrator</p><h1>Profile & settings</h1><p>Manage your Admin profile and secure this account.</p></div>
          <button className="icon-button admin-settings-close" type="button" onClick={closeSettings} aria-label="Close profile and settings" title="Close profile and settings"><X aria-hidden="true" /></button>
        </header>
        {error ? <p className="admin-notice admin-error-notice" role="alert">{error}</p> : null}
        {notice ? <p className="admin-notice" role="status">{notice}</p> : null}
        {!profileReady ? <section className="admin-profile-setup-notice" aria-labelledby="admin-profile-setup-title">
          <div><strong id="admin-profile-setup-title">Admin profile setup is incomplete</strong><p>You are signed in. Name, mobile number and photo editing will be available once the Admin profile storage is set up. Your email and password settings are available below.</p></div>
          <button className="secondary-button" type="button" onClick={() => { setAccess("loading"); void load(); }}><RefreshCw /> Check setup again</button>
        </section> : null}

        <div className="admin-settings-grid">
          <section className="admin-settings-card admin-profile-settings-card">
            <header><ShieldCheck /><div><p className="eyebrow">Admin identity</p><h2>Your profile</h2><p>Your image appears in the Admin header. Hover over it to see your email address.</p></div></header>
            <div className="admin-settings-avatar-row">
              <span className="admin-settings-avatar">{avatarUrl ? <img src={avatarUrl} alt="Your Admin profile" /> : initials}</span>
              <div><strong>{fullName || "Administrator"}</strong><span className="admin-profile-role-badge">{adminRoleLabels(roles).join(" • ") || "Administrator"}</span><small>{email}</small><div><button className="secondary-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={Boolean(busy) || !profileReady}>{busy === "avatar" ? <LoaderCircle className="admin-spinner" /> : <ImagePlus />} {avatarUrl ? "Change photo" : "Upload photo"}</button>{avatarUrl ? <button className="danger-button" type="button" onClick={() => void removeAvatar()} disabled={Boolean(busy) || !profileReady}>{busy === "remove-avatar" ? <LoaderCircle className="admin-spinner" /> : <Trash2 />} Remove</button> : null}</div><small>JPG, PNG or WebP · up to 8 MB</small></div>
              <input ref={fileInputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadAvatar(event)} disabled={Boolean(busy) || !profileReady} aria-label="Upload Admin profile image" />
            </div>
            <dl className="admin-profile-details">
              {([
                { field: "full_name", label: "Name", value: fullName, type: "text", autoComplete: "name", maxLength: 100 },
                { field: "email", label: "Email address", value: email, type: "email", autoComplete: "email", maxLength: 254 },
                { field: "phone", label: "Mobile number", value: phone, type: "tel", autoComplete: "tel", maxLength: 40 },
              ] as const).map(({ field, label, value, type, autoComplete, maxLength }) => <div className="admin-profile-detail" key={field}>
                <dt id={`admin-profile-${field}-label`}>{label}</dt>
                <dd>{editingField === field ? <form onSubmit={(event) => { event.preventDefault(); if (editingField) void saveProfile(editingField); }}>
                  <input aria-labelledby={`admin-profile-${field}-label`} type={type} autoComplete={autoComplete} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={maxLength} required={field === "full_name"} minLength={field === "full_name" ? 2 : undefined} disabled={Boolean(busy)} autoFocus />
                  <div className="admin-profile-edit-actions">
                    <button className="primary-button" type="submit" disabled={Boolean(busy)}>{busy === "profile" ? <LoaderCircle className="admin-spinner" /> : <Save />} Save</button>
                    <button className="secondary-button" type="button" onClick={() => { setEditingField(null); setDraft(""); setError(""); }} disabled={Boolean(busy)}>Cancel</button>
                  </div>
                </form> : <>
                  <p>{field !== "email" && !profileReady ? "Unavailable until setup is complete" : value || "Not added"}</p>
                  {field !== "email" ? <button className="admin-profile-edit-button" type="button" aria-label={`Edit ${label.toLowerCase()}`} onClick={() => editProfile(field)} disabled={Boolean(busy) || Boolean(editingField) || !profileReady}><Pencil /> Edit</button> : <small>Used to sign in</small>}
                </>}</dd>
              </div>)}
            </dl>
            <div className="admin-profile-password-action"><AdminPasswordDialog email={email} onChanged={() => { setError(""); setNotice("Password changed successfully."); }} /></div>
          </section>
        </div>
      </section>
    </main>
  );
}

"use client";

/* eslint-disable @next/next/no-img-element -- the avatar is a user-managed Supabase image. */

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, LoaderCircle, LogOut, RefreshCw, Save, Settings, ShieldCheck, Trash2 } from "lucide-react";
import { AdminAccessCard, type AdminAccessState } from "@/components/admin-access-card";
import { AdminSidebar } from "@/components/admin-sidebar";
import { PasswordSettings } from "@/components/password-settings";
import { hasAdminAccess } from "@/lib/admin-permissions";
import { createClient } from "@/lib/supabase/client";

const avatarBucket = "admin-profile-images";

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<"profile" | "avatar" | "remove-avatar" | "switch" | "logout" | "">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
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
      supabase.from("profiles").select("full_name,phone,avatar_url").eq("id", authData.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", authData.user.id),
    ]);
    if (profileResult.error || roleResult.error) {
      setAccess("error");
      setError(profileResult.error?.message ?? roleResult.error?.message ?? "The Admin profile could not be loaded.");
      return;
    }

    const detectedRoles = (roleResult.data ?? []).map((row) => String(row.role));
    setRoles(detectedRoles);
    if (!hasAdminAccess(detectedRoles)) {
      setAccess("denied");
      return;
    }
    setFullName(String(profileResult.data?.full_name || authData.user.user_metadata?.full_name || ""));
    setPhone(String(profileResult.data?.phone || ""));
    setAvatarUrl(profileResult.data?.avatar_url ? String(profileResult.data.avatar_url) : null);
    setAccess("allowed");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function announceUpdate() {
    window.dispatchEvent(new Event("khete-admin-profile-updated"));
  }

  async function saveProfile() {
    if (!userId || fullName.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }
    setBusy("profile");
    setError("");
    setNotice("");
    const supabase = createClient();
    const { error: profileError } = await supabase.from("profiles").update({
      full_name: fullName.trim(),
      phone: phone.trim() || null,
    }).eq("id", userId);
    if (!profileError) {
      await supabase.auth.updateUser({ data: { full_name: fullName.trim() } });
      setNotice("Admin profile updated.");
      announceUpdate();
    } else {
      setError(profileError.message);
    }
    setBusy("");
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
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
      if (uploadError) throw uploadError;

      const publicUrl = supabase.storage.from(avatarBucket).getPublicUrl(storagePath).data.publicUrl;
      const nextUrl = `${publicUrl}?v=${Date.now()}`;
      const { error: profileError } = await supabase.from("profiles").update({ avatar_url: nextUrl }).eq("id", userId);
      if (profileError) {
        await supabase.storage.from(avatarBucket).remove([storagePath]);
        throw profileError;
      }

      const previousPath = storedAvatarPath(avatarUrl);
      setAvatarUrl(nextUrl);
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
    if (!userId || !avatarUrl) return;
    setBusy("remove-avatar");
    setError("");
    setNotice("");
    const supabase = createClient();
    const { error: profileError } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
    if (profileError) {
      setError(profileError.message);
    } else {
      const previousPath = storedAvatarPath(avatarUrl);
      if (previousPath) await supabase.storage.from(avatarBucket).remove([previousPath]);
      setAvatarUrl(null);
      setNotice("Profile image removed.");
      announceUpdate();
    }
    setBusy("");
  }

  async function leaveAdmin(mode: "switch" | "logout") {
    setBusy(mode);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace(mode === "switch" ? "/admin/login?switch=1" : "/admin/login");
    router.refresh();
  }

  if (access !== "allowed") {
    return <AdminAccessCard access={access} email={email} roles={roles} origin={origin} resource="Admin profile settings" error={error} requirement="an active khetE administration role" returnTo="/admin/settings" />;
  }

  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "A";

  return (
    <main className="admin-shell admin-settings-page">
      <AdminSidebar active="settings" roles={roles} />
      <section className="admin-main">
        <header className="admin-page-heading"><div><p className="eyebrow">Signed-in administrator</p><h1>Profile & settings</h1><p>Manage the identity shown throughout the Admin panel and secure this account.</p></div></header>
        {error ? <p className="admin-notice admin-error-notice" role="alert">{error}</p> : null}
        {notice ? <p className="admin-notice" role="status">{notice}</p> : null}

        <div className="admin-settings-grid">
          <section className="admin-settings-card admin-profile-settings-card">
            <header><ShieldCheck /><div><p className="eyebrow">Admin identity</p><h2>Your profile</h2><p>This name and image identify the person currently operating every Admin page.</p></div></header>
            <div className="admin-settings-avatar-row">
              <span className="admin-settings-avatar">{avatarUrl ? <img src={avatarUrl} alt="Your Admin profile" /> : initials}</span>
              <div><strong>{fullName || "Administrator"}</strong><small>{email}</small><div><button className="secondary-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={Boolean(busy)}>{busy === "avatar" ? <LoaderCircle className="admin-spinner" /> : <ImagePlus />} {avatarUrl ? "Change image" : "Upload image"}</button>{avatarUrl ? <button className="danger-button" type="button" onClick={() => void removeAvatar()} disabled={Boolean(busy)}>{busy === "remove-avatar" ? <LoaderCircle className="admin-spinner" /> : <Trash2 />} Remove</button> : null}</div></div>
              <input ref={fileInputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadAvatar(event)} aria-label="Upload Admin profile image" />
            </div>
            <div className="admin-settings-fields">
              <label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
              <label>Email address<input value={email} readOnly aria-readonly="true" /></label>
              <label>Phone number<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
            </div>
            <button className="primary-button admin-settings-save" type="button" onClick={() => void saveProfile()} disabled={Boolean(busy)}>{busy === "profile" ? <LoaderCircle className="admin-spinner" /> : <Save />} Save profile</button>
          </section>

          <PasswordSettings title="Change Admin password" description="Change the password for this signed-in administrator. Google sign-in remains available when connected." />

          <section className="admin-settings-card admin-session-settings-card">
            <header><Settings /><div><p className="eyebrow">Session controls</p><h2>Account access</h2><p>End this session or return to the secure login page to use another Admin account.</p></div></header>
            <div>
              <button className="secondary-button" type="button" onClick={() => void leaveAdmin("switch")} disabled={Boolean(busy)}>{busy === "switch" ? <LoaderCircle className="admin-spinner" /> : <RefreshCw />} Sign in to another account</button>
              <button className="danger-button" type="button" onClick={() => void leaveAdmin("logout")} disabled={Boolean(busy)}>{busy === "logout" ? <LoaderCircle className="admin-spinner" /> : <LogOut />} Log out</button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { ADMIN_PHOTO_CHANGED, cacheAdminPhoto, notifyAdminPhoto, readAdminPhoto } from "@/lib/admin-profile-photo";
import { createClient } from "@/lib/supabase/admin-client";

export function useAdminProfilePhoto(userId: string | null | undefined) {
  const [snapshot, setSnapshot] = useState<{ userId: string; photo: string | null } | null>(null);

  useEffect(() => {
    if (!userId) return;
    const ownerId = userId;
    let active = true;
    let revision = 0;

    async function load() {
      const requestRevision = ++revision;
      const cached = readAdminPhoto(ownerId);
      if (cached !== undefined) setSnapshot({ userId: ownerId, photo: cached });
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!active || requestRevision !== revision || authData.user?.id !== ownerId) return;
      const { data: profile, error } = await supabase.from("admin_profiles").select("avatar_url").eq("user_id", ownerId).maybeSingle();
      if (!active || requestRevision !== revision || error) return;
      const photo = typeof profile?.avatar_url === "string" && profile.avatar_url ? profile.avatar_url : null;
      cacheAdminPhoto(ownerId, photo);
      setSnapshot({ userId: ownerId, photo });
    }

    function handleChanged(event: Event) {
      const detail = (event as CustomEvent<{ userId: string; photo: string | null }>).detail;
      if (!active || detail?.userId !== ownerId) return;
      revision++;
      setSnapshot({ userId: ownerId, photo: detail.photo });
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === `khete-admin-photo:${ownerId}`) void load();
    }

    void load();
    window.addEventListener(ADMIN_PHOTO_CHANGED, handleChanged);
    window.addEventListener("storage", handleStorage);
    return () => {
      active = false;
      window.removeEventListener(ADMIN_PHOTO_CHANGED, handleChanged);
      window.removeEventListener("storage", handleStorage);
    };
  }, [userId]);

  const savePhoto = useCallback(async (photo: string | null) => {
    if (!userId) throw new Error("Sign in to Admin before changing the Admin profile photo.");
    const { error } = await createClient().from("admin_profiles")
      .update({ avatar_url: photo })
      .eq("user_id", userId)
      .select("avatar_url")
      .single();
    if (error) throw new Error(`The Admin photo could not be saved: ${error.message}`);
    cacheAdminPhoto(userId, photo);
    notifyAdminPhoto(userId, photo);
  }, [userId]);

  return { photo: snapshot && snapshot.userId === userId ? snapshot.photo : null, savePhoto };
}

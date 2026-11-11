"use client";

import { useCallback, useEffect, useState } from "react";
import { cacheProfilePhoto, clearUnclaimedProfilePhoto, notifyProfilePhotoChanged, PROFILE_PHOTO_CHANGED, readCachedProfilePhoto, readUnclaimedProfilePhoto, resolveProfilePhoto } from "@/lib/profile-photo";
import { createClient } from "@/lib/supabase/client";

const photoWrites = new Map<string, Promise<void>>();

async function persistPhoto(userId: string, photo: string | null) {
  const previousWrite = photoWrites.get(userId) ?? Promise.resolve();
  const write = previousWrite.catch(() => {}).then(async () => {
    const { error } = await createClient().from("profiles")
      .update({ avatar_url: photo ?? "" })
      .eq("id", userId)
      .select("avatar_url")
      .single();
    if (error) throw new Error(`The photo is shown in this browser, but could not be saved to your account: ${error.message}`);
    if (readCachedProfilePhoto(userId)?.photo === photo) cacheProfilePhoto(userId, photo);
  });
  photoWrites.set(userId, write);
  try {
    await write;
  } finally {
    if (photoWrites.get(userId) === write) photoWrites.delete(userId);
  }
}

export function useProfilePhoto(userId: string | null | undefined) {
  const [snapshot, setSnapshot] = useState<{ userId: string; photo: string | null; previousPhoto: string | null } | null>(null);

  useEffect(() => {
    if (!userId) return;
    const ownerId = userId;
    let active = true;
    let revision = 0;

    async function load() {
      const requestRevision = ++revision;
      const cached = readCachedProfilePhoto(ownerId);
      if (cached) setSnapshot({ userId: ownerId, photo: cached.photo, previousPhoto: readUnclaimedProfilePhoto() });
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!active || requestRevision !== revision || authData.user?.id !== ownerId) return;
      const { data: profile, error } = await supabase.from("profiles").select("avatar_url").eq("id", ownerId).maybeSingle();
      if (!active || requestRevision !== revision) return;
      const photo = resolveProfilePhoto(error ? undefined : profile?.avatar_url, authData.user.user_metadata, cached);
      setSnapshot({ userId: ownerId, photo, previousPhoto: readUnclaimedProfilePhoto() });
      if (cached?.pending) {
        try {
          await persistPhoto(ownerId, cached.photo);
        } catch {
          // Keep the existing upload visible and retry on the next page visit.
        }
      } else if (!error) {
        cacheProfilePhoto(ownerId, photo);
      }
    }

    function handlePhotoChanged(event: Event) {
      const detail = (event as CustomEvent<{ userId: string; photo: string | null }>).detail;
      if (!active || detail?.userId !== ownerId) return;
      revision++;
      setSnapshot({ userId: ownerId, photo: detail.photo, previousPhoto: readUnclaimedProfilePhoto() });
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === `khete-profile-photo:${ownerId}`) void load();
    }

    void load();
    window.addEventListener(PROFILE_PHOTO_CHANGED, handlePhotoChanged);
    window.addEventListener("storage", handleStorage);
    return () => {
      active = false;
      window.removeEventListener(PROFILE_PHOTO_CHANGED, handlePhotoChanged);
      window.removeEventListener("storage", handleStorage);
    };
  }, [userId]);

  const savePhoto = useCallback(async (photo: string | null) => {
    if (!userId) throw new Error("Sign in before updating your profile photo.");
    cacheProfilePhoto(userId, photo, true);
    notifyProfilePhotoChanged(userId, photo);
    await persistPhoto(userId, photo);
    if (photo) clearUnclaimedProfilePhoto(photo);
    if (readCachedProfilePhoto(userId)?.photo === photo) notifyProfilePhotoChanged(userId, photo);
  }, [userId]);

  const currentSnapshot = snapshot && snapshot.userId === userId ? snapshot : null;
  return { photo: currentSnapshot?.photo ?? null, previousPhoto: currentSnapshot?.previousPhoto ?? null, savePhoto };
}

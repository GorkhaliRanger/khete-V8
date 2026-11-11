export const PROFILE_PHOTO_CHANGED = "khete-profile-photo-changed";
const cachePrefix = "khete-profile-photo:";

export type CachedProfilePhoto = { photo: string | null; pending: boolean };
const memoryCache = new Map<string, CachedProfilePhoto>();

export function cacheProfilePhoto(userId: string, photo: string | null, pending = false) {
  const value = { photo, pending };
  memoryCache.set(userId, value);
  try {
    localStorage.setItem(`${cachePrefix}${userId}`, JSON.stringify(value));
  } catch {
    // The current tab still shows the photo when browser storage is unavailable.
  }
  return value;
}

export function readCachedProfilePhoto(userId: string): CachedProfilePhoto | undefined {
  try {
    const stored = localStorage.getItem(`${cachePrefix}${userId}`);
    if (stored) {
      const value = JSON.parse(stored) as CachedProfilePhoto;
      if (value && (value.photo === null || typeof value.photo === "string")) {
        memoryCache.set(userId, value);
        return value;
      }
    }

    // Only migrate automatically when the previous upload's owner is known.
    const legacyOwner = localStorage.getItem("khete-profile-photo-owner");
    const legacyPhoto = localStorage.getItem("khete-profile-photo");
    if (legacyPhoto && legacyOwner === userId) {
      const value = cacheProfilePhoto(userId, legacyPhoto, true);
      localStorage.removeItem("khete-profile-photo");
      localStorage.removeItem("khete-profile-photo-owner");
      return value;
    }
  } catch {
    // Fall back to the per-account memory cache.
  }
  return memoryCache.get(userId);
}

export function readUnclaimedProfilePhoto() {
  try {
    return localStorage.getItem("khete-profile-photo-owner") ? null : localStorage.getItem("khete-profile-photo");
  } catch {
    return null;
  }
}

export function clearUnclaimedProfilePhoto(photo: string) {
  try {
    if (readUnclaimedProfilePhoto() === photo) localStorage.removeItem("khete-profile-photo");
  } catch {
    // Keep the legacy upload available if browser storage cannot be changed.
  }
}

export function resolveProfilePhoto(
  profileValue: unknown,
  metadata: Record<string, unknown> = {},
  cached?: CachedProfilePhoto,
) {
  if (cached?.pending) return cached.photo;
  // An empty value explicitly removes a custom/Google photo; null is unset.
  if (typeof profileValue === "string") return profileValue.trim() || null;
  if (cached) return cached.photo;
  const providerPhoto = metadata.avatar_url || metadata.picture;
  return typeof providerPhoto === "string" && providerPhoto.trim() ? providerPhoto : null;
}

export function notifyProfilePhotoChanged(userId: string, photo: string | null) {
  window.dispatchEvent(new CustomEvent(PROFILE_PHOTO_CHANGED, { detail: { userId, photo } }));
}

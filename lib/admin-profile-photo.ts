export const ADMIN_PHOTO_CHANGED = "khete-admin-photo-changed";
const memoryCache = new Map<string, string | null>();

export function readAdminPhoto(userId: string): string | null | undefined {
  try {
    const stored = localStorage.getItem(`khete-admin-photo:${userId}`);
    if (stored !== null) {
      const value = JSON.parse(stored) as unknown;
      if (value === null || typeof value === "string") {
        memoryCache.set(userId, value);
        return value;
      }
    }
  } catch {
    // Keep the current Admin preview available when local storage is disabled.
  }
  return memoryCache.get(userId);
}

export function cacheAdminPhoto(userId: string, photo: string | null) {
  memoryCache.set(userId, photo);
  try {
    localStorage.setItem(`khete-admin-photo:${userId}`, JSON.stringify(photo));
  } catch {
    // The current tab can still show its own Admin photo.
  }
}

export function notifyAdminPhoto(userId: string, photo: string | null) {
  window.dispatchEvent(new CustomEvent(ADMIN_PHOTO_CHANGED, { detail: { userId, photo } }));
}

export const ADMIN_AUTH_COOKIE_NAME = "khete-admin-auth";
export const ADMIN_AUTH_CALLBACK_PATH = "/admin/auth/callback";
export const ADMIN_PASSWORD_UPDATE_PATH = "/admin/update-password";

export function isAdminRequestPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/")
    || pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

export function safeAdminDestination(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/admin";
  try {
    const base = "https://admin.internal";
    const destination = new URL(value, base);
    const isAdminPage = destination.pathname === "/admin" || destination.pathname.startsWith("/admin/");
    if (destination.origin !== base || !isAdminPage || destination.pathname === ADMIN_AUTH_CALLBACK_PATH) return "/admin";
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/admin";
  }
}

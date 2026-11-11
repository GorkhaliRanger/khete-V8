export function adminSettingsReturnPath(value: string | null, origin: string) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/admin";

  try {
    const destination = new URL(value, origin);
    const isAdminPage = destination.pathname === "/admin" || destination.pathname.startsWith("/admin/");
    const isAccountRoute = ["/admin/settings", "/admin/login", "/admin/verify"].some(
      (path) => destination.pathname === path || destination.pathname.startsWith(`${path}/`),
    );
    if (destination.origin !== origin || !isAdminPage || isAccountRoute) return "/admin";
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/admin";
  }
}

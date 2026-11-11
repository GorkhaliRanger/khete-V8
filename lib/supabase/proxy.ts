import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";
import { ADMIN_AUTH_COOKIE_NAME, isAdminRequestPath } from "./admin-auth";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseConfig();
  const adminRequest = isAdminRequestPath(request.nextUrl.pathname);

  const supabase = createServerClient(url, publishableKey, {
    ...(adminRequest ? { cookieOptions: { name: ADMIN_AUTH_COOKIE_NAME, path: "/", sameSite: "lax" as const } } : {}),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(cacheHeaders).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  await supabase.auth.getClaims();
  if (adminRequest) response.headers.set("Cache-Control", "private, no-store");
  if (request.nextUrl.pathname === "/admin/update-password") response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

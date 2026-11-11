import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_AUTH_COOKIE_NAME } from "./admin-auth";
import { getSupabaseConfig } from "./config";

let adminBrowserClient: SupabaseClient | undefined;

export function createClient() {
  if (adminBrowserClient) return adminBrowserClient;
  const { url, publishableKey } = getSupabaseConfig();
  adminBrowserClient = createBrowserClient(url, publishableKey, {
    // @supabase/ssr's package singleton is shared across all cookie names.
    // Each application realm therefore maintains its own client instance.
    isSingleton: false,
    cookieOptions: { name: ADMIN_AUTH_COOKIE_NAME, path: "/", sameSite: "lax" },
  });
  return adminBrowserClient;
}

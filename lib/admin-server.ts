import "server-only";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

const managedAdminRoles = new Set([
  "product_inventory_manager",
  "order_delivery_manager",
  "customer_support",
  "finance_manager",
  "content_promotion_manager",
]);

export type SuperAdminContext = {
  supabase: SupabaseClient;
  user: User;
};

export type ManagedAdminTarget = {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
};

export async function getSuperAdminContext(): Promise<SuperAdminContext | null> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", authData.user.id);
  if (roleError || !(roleRows ?? []).some((row) => row.role === "super_admin")) return null;

  return { supabase, user: authData.user };
}

export async function getManagedAdminTarget(
  supabase: SupabaseClient,
  userId: string,
): Promise<ManagedAdminTarget | null | "protected"> {
  const [{ data: profile, error: profileError }, { data: roleRows, error: roleError }] = await Promise.all([
    supabase.from("profiles").select("id,email,full_name").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (profileError || roleError || !profile) return null;

  const roles = (roleRows ?? []).map((row) => String(row.role));
  if (roles.includes("super_admin")) return "protected";
  if (!roles.some((role) => managedAdminRoles.has(role))) return null;

  return {
    id: String(profile.id),
    email: String(profile.email ?? ""),
    fullName: String(profile.full_name ?? ""),
    roles,
  };
}

export function createSupabaseAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not configured on the server.");
  }
  const { url } = getSupabaseConfig();
  return createAdminClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

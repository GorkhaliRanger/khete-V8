import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/admin-server";

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

  const [{ data: roleRows, error: roleError }, { data: adminProfile, error: profileError }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", authData.user.id),
    supabase.from("admin_profiles").select("is_active").eq("user_id", authData.user.id).maybeSingle(),
  ]);
  if (roleError || profileError || !adminProfile?.is_active
    || !(roleRows ?? []).some((row) => row.role === "super_admin")) return null;

  return { supabase, user: authData.user };
}

export async function getManagedAdminTarget(
  supabase: SupabaseClient,
  userId: string,
): Promise<ManagedAdminTarget | null | "protected"> {
  const { data, error } = await supabase.rpc("admin_user_directory");
  if (error) return null;
  const account = ((data ?? []) as Array<{ user_id: string; email: string; full_name: string; roles: string[] }>).find(
    (row) => row.user_id === userId,
  );
  if (!account) return null;

  const roles = account.roles.map(String);
  if (roles.includes("super_admin")) return "protected";
  if (!roles.some((role) => managedAdminRoles.has(role))) return null;

  return {
    id: account.user_id,
    email: String(account.email ?? ""),
    fullName: String(account.full_name ?? ""),
    roles,
  };
}


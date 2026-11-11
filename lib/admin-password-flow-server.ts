import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { hasAdminAccess } from "@/lib/admin-permissions";
import { createClient as createAdminClient } from "@/lib/supabase/admin-server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createPasswordFlowService, PASSWORD_FLOW_COOKIE, PasswordFlowError, type PasswordFlowIdentity, type PasswordRecoverySession } from "@/lib/admin-password-flow";

const recoveryStorageKey = "khete-admin-password-verification";

function isolatedRecoveryClient(verifier?: string) {
  const values = new Map<string, string>();
  if (verifier) values.set(`${recoveryStorageKey}-code-verifier`, verifier);
  const { url, publishableKey } = getSupabaseConfig();
  const client = createSupabaseClient(url, publishableKey, {
    auth: {
      flowType: "pkce", persistSession: true, autoRefreshToken: false, detectSessionInUrl: false,
      storageKey: recoveryStorageKey,
      storage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); } },
    },
  });
  return { client, values };
}

async function identity(client: SupabaseClient): Promise<PasswordFlowIdentity> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email) throw new PasswordFlowError("Sign in to your Admin account to change its password.", 401);
  const user = data.user;
  const [roleResult, profileResult, sessionResult] = await Promise.all([
    client.from("user_roles").select("role").eq("user_id", user.id),
    client.from("admin_profiles").select("is_active").eq("user_id", user.id).maybeSingle(),
    client.auth.getSession(),
  ]);
  if (roleResult.error || profileResult.error) throw new PasswordFlowError("Admin access could not be checked. Please try again.", 503);
  if (!hasAdminAccess((roleResult.data ?? []).map((row) => String(row.role))) || !profileResult.data?.is_active) throw new PasswordFlowError("An active Admin account is required.", 403);
  // getUser above verifies this request's token with Auth before claims below
  // are used only to bind the flow to its originating session, never as roles.
  const token = sessionResult.data.session?.access_token;
  let claims: { sub?: string; session_id?: string } = {};
  try { claims = JSON.parse(Buffer.from(token?.split(".")[1] ?? "", "base64url").toString("utf8")); } catch { /* handled below */ }
  if (claims.sub !== user.id || typeof claims.session_id !== "string") throw new PasswordFlowError("Sign in again before changing your password.", 401);
  return { id: user.id, email: user.email!, sessionId: claims.session_id };
}

export async function passwordFlowService(request: NextRequest) {
  const admin = await createAdminClient();
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production" || request.nextUrl.protocol === "https:";
  const cookieOptions = { httpOnly: true, secure, sameSite: "lax" as const, path: "/api/admin/password-change" };
  return createPasswordFlowService({
    authenticate: () => identity(admin),
    secret: process.env.ADMIN_PASSWORD_FLOW_SECRET,
    cookie: () => cookieStore.get(PASSWORD_FLOW_COOKIE)?.value,
    writeCookie: (value, maxAge) => cookieStore.set(PASSWORD_FLOW_COOKIE, value, { ...cookieOptions, maxAge }),
    clearCookie: () => cookieStore.set(PASSWORD_FLOW_COOKIE, "", { ...cookieOptions, maxAge: 0 }),
    register: async (id, userId, expiresAt) => {
      const { error } = await admin.from("admin_password_change_requests").insert({ id, user_id: userId, expires_at: expiresAt });
      if (error) throw new PasswordFlowError("Password verification storage is unavailable. Contact the site administrator.", 503);
    },
    request: async (id) => {
      const { data, error } = await admin.from("admin_password_change_requests").select("user_id,expires_at,consumed_at").eq("id", id).maybeSingle();
      if (error) throw new PasswordFlowError("Password verification could not be checked. Please try again.", 503);
      return data;
    },
    consume: async (id) => {
      const { data, error } = await admin.rpc("consume_admin_password_change_request", { request_id: id });
      if (error) throw new PasswordFlowError("Password verification could not be completed. Please try again.", 503);
      return data === true;
    },
    sendLink: async (email, redirectTo) => {
      const recovery = isolatedRecoveryClient();
      const { error } = await recovery.client.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw new PasswordFlowError(error.message, error.status === 429 ? 429 : 400);
      const verifier = recovery.values.get(`${recoveryStorageKey}-code-verifier`);
      if (!verifier) throw new PasswordFlowError("The verification link could not be prepared. Please try again.", 503);
      return verifier;
    },
    exchangeCode: async (code, verifier) => {
      const { client } = isolatedRecoveryClient(verifier);
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error || !data.user || !data.session) throw new PasswordFlowError("The email link has expired or has already been used. Request a new link.");
      return { user: data.user, session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } };
    },
    changePassword: async (session, password) => {
      const { client } = isolatedRecoveryClient();
      const { data: adopted, error: sessionError } = await client.auth.setSession(session);
      if (sessionError || !adopted.user) throw new Error("The verified email session has expired.");
      const current = await identity(admin);
      const { data: verified, error: verifiedError } = await client.auth.getUser();
      if (verifiedError || verified.user?.id !== current.id || verified.user.email?.toLowerCase() !== current.email.toLowerCase()) throw new Error("The verified email session does not match this Admin account.");
      const { error } = await client.auth.updateUser({ password });
      if (error) throw new Error(error.message);
      const { data: refreshed } = await client.auth.getSession();
      if (!refreshed.session) return session;
      return { access_token: refreshed.session.access_token, refresh_token: refreshed.session.refresh_token };
    },
    adoptSession: async (session: PasswordRecoverySession) => {
      try { const { error } = await admin.auth.setSession(session); return !error; } catch { return false; }
    },
  });
}

export function passwordFlowResponse(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store", "Pragma": "no-cache", "Referrer-Policy": "no-referrer" } });
}

export function passwordFlowFailure(error: unknown) {
  return passwordFlowResponse({ error: error instanceof PasswordFlowError ? error.message : "Password verification could not be completed. Please try again." }, error instanceof PasswordFlowError ? error.status : 500);
}

export function requirePasswordFlowOrigin(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) throw new PasswordFlowError("Invalid request origin.", 403);
}

export async function passwordFlowBody(request: NextRequest) {
  if (!request.headers.get("content-type")?.startsWith("application/json") || Number(request.headers.get("content-length") ?? 0) > 8192) throw new PasswordFlowError("Invalid request.");
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid JSON object.");
    return body as Record<string, unknown>;
  } catch { throw new PasswordFlowError("Invalid request."); }
}

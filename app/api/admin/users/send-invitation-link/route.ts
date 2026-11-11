import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSuperAdminContext } from "@/lib/admin-server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

function reply(body: Record<string, unknown>, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return reply({ error: "Invalid request origin." }, 403);
  }

  const context = await getSuperAdminContext();
  if (!context) return reply({ error: "Super Admin access is required." }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reply({ error: "Enter the invited email address." }, 400);
  }
  const email = typeof body === "object" && body !== null && "email" in body && typeof body.email === "string"
    ? body.email.trim().toLowerCase()
    : "";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return reply({ error: "Enter a valid invited email address." }, 400);
  }

  // The invitation table has no direct client access. The guarded directory
  // RPC confirms that a Super Admin created a current invitation first.
  const { data: invitations, error: directoryError } = await context.supabase.rpc("admin_invitation_directory");
  if (directoryError) return reply({ error: "The pending invitation could not be checked." }, 503);
  const pending = (invitations ?? []).some((invitation: {
    email?: string; status?: string; expires_at?: string;
  }) => invitation.email?.toLowerCase() === email
    && invitation.status === "pending"
    && Boolean(invitation.expires_at)
    && new Date(invitation.expires_at!).getTime() > Date.now());
  if (!pending) return reply({ error: "No current Admin invitation exists for that email." }, 404);

  const { url, publishableKey } = getSupabaseConfig();
  // @supabase/ssr uses PKCE by default. Its verifier would be stored in the
  // Super Admin's browser and unavailable when the invitee opens the email.
  const mailClient = createClient(url, publishableKey, {
    auth: {
      flowType: "implicit",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const redirectTo = `${request.nextUrl.origin}/admin/verify?email=${encodeURIComponent(email)}`;
  const { error: sendError } = await mailClient.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
  });
  if (sendError) return reply({ error: sendError.message }, 400);
  return reply({ ok: true });
}

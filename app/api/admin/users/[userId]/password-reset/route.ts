import { NextRequest, NextResponse } from "next/server";
import { getManagedAdminTarget, getSuperAdminContext } from "@/lib/admin-server";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_PASSWORD_UPDATE_PATH } from "@/lib/supabase/admin-auth";
import { getSupabaseConfig } from "@/lib/supabase/config";

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const context = await getSuperAdminContext();
  if (!context) {
    return NextResponse.json({ error: "Super Admin access is required." }, { status: 403 });
  }

  const { userId } = await params;
  const target = await getManagedAdminTarget(context.supabase, userId);
  if (target === "protected") {
    return NextResponse.json({ error: "Super Admin passwords cannot be changed from this page." }, { status: 403 });
  }
  if (!target?.email) {
    return NextResponse.json({ error: "The selected administrator has no registered email address." }, { status: 404 });
  }

  const { url, publishableKey } = getSupabaseConfig();
  // The recipient opens this link in their own browser. A PKCE verifier stored
  // in the requesting Super Admin's session cannot be used by that recipient.
  const recoveryClient = createClient(url, publishableKey, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const redirectTo = `${request.nextUrl.origin}${ADMIN_PASSWORD_UPDATE_PATH}`;
  const { error: resetError } = await recoveryClient.auth.resetPasswordForEmail(target.email, { redirectTo });
  if (resetError) {
    return NextResponse.json({ error: resetError.message }, { status: 400 });
  }

  const { error: auditError } = await context.supabase.rpc("record_admin_password_reset", {
    target_user_id: target.id,
  });
  if (auditError) {
    return NextResponse.json({
      error: "The reset email was sent, but the activity record could not be saved. Contact the system administrator.",
    }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}

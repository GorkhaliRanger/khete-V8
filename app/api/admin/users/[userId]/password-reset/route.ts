import { NextRequest, NextResponse } from "next/server";
import { getManagedAdminTarget, getSuperAdminContext } from "@/lib/admin-server";

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

  const redirectTo = `${request.nextUrl.origin}/auth/callback?next=${encodeURIComponent("/account/update-password")}`;
  const { error: resetError } = await context.supabase.auth.resetPasswordForEmail(target.email, { redirectTo });
  if (resetError) {
    return NextResponse.json({ error: resetError.message }, { status: 400 });
  }

  await context.supabase.from("admin_audit_log").insert({
    actor_user_id: context.user.id,
    target_user_id: target.id,
    action: "admin_password_reset_requested",
    details: { email: target.email },
  });

  return NextResponse.json({ ok: true });
}

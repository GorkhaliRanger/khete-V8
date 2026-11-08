import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, getManagedAdminTarget, getSuperAdminContext } from "@/lib/admin-server";

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function DELETE(
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
    return NextResponse.json({ error: "Super Admin accounts are protected and cannot be deleted." }, { status: 403 });
  }
  if (!target) {
    return NextResponse.json({ error: "The selected administrator was not found." }, { status: 404 });
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(target.id);
    if (deleteError) throw deleteError;

    await context.supabase.from("admin_audit_log").insert({
      actor_user_id: context.user.id,
      target_user_id: target.id,
      action: "admin_account_deleted",
      details: { email: target.email, full_name: target.fullName, roles: target.roles },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The administrator could not be deleted.";
    const status = message.includes("SUPABASE_SECRET_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

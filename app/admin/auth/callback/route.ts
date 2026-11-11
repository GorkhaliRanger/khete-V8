import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/admin-server";
import { safeAdminDestination } from "@/lib/supabase/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const next = safeAdminDestination(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const requestedType = searchParams.get("type");
  const tokenType = requestedType === "recovery" || requestedType === "invite" || requestedType === "email"
    ? requestedType
    : null;

  if (code || (tokenHash && tokenType)) {
    const supabase = await createClient();
    const result = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: tokenType! });
    if (!result.error) {
      const response = NextResponse.redirect(`${origin}${next}`);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
  }

  const response = NextResponse.redirect(`${origin}/admin/login?authError=callback`);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

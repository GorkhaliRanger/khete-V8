export type AdminRecoveryEntry =
  | { kind: "code"; code: string }
  | { kind: "implicit"; accessToken: string; refreshToken: string }
  | { kind: "none" };

/** A normal signed-in visit is never treated as email verification. */
export function readAdminRecoveryEntry(search: string, hash: string): AdminRecoveryEntry {
  const code = new URLSearchParams(search).get("code");
  if (code) return { kind: "code", code };
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  if (fragment.get("type") === "recovery" && accessToken && refreshToken) {
    return { kind: "implicit", accessToken, refreshToken };
  }
  return { kind: "none" };
}

/** Call only with claims returned by a successful Supabase getClaims() check.
 * Older implicit recovery links use the signed AMR method `otp`; PKCE/newer
 * recovery sessions may use `recovery`. A URL's type parameter is not proof.
 */
export function hasFreshAdminEmailRecoveryProof(claims: unknown, userId: string, nowSeconds: number) {
  if (!claims || typeof claims !== "object") return false;
  const value = claims as { sub?: unknown; amr?: unknown };
  if (value.sub !== userId || !Array.isArray(value.amr)) return false;
  return value.amr.some((entry: unknown) => {
    if (!entry || typeof entry !== "object") return false;
    const method = entry as { method?: unknown; timestamp?: unknown };
    return ["otp", "recovery"].includes(String(method.method))
      && typeof method.timestamp === "number" && Number.isFinite(method.timestamp)
      && method.timestamp >= nowSeconds - 15 * 60 && method.timestamp <= nowSeconds + 30;
  });
}

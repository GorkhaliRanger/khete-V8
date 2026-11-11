export type InvitationLinkState =
  | { kind: "none"; cleanUrl: string }
  | { kind: "invalid"; cleanUrl: string }
  | { kind: "session"; cleanUrl: string; accessToken: string; refreshToken: string };

/** The implicit email link is opened by the invitee, never by its sender. */
export function readInvitationLink(url: string): InvitationLinkState {
  const destination = new URL(url);
  const hash = new URLSearchParams(destination.hash.slice(1));
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  const hasAuthFragment = Boolean(accessToken || refreshToken || hash.has("error") || hash.has("error_description"));
  destination.hash = "";
  const cleanUrl = destination.toString();
  if (!hasAuthFragment) return { kind: "none", cleanUrl };
  if (!accessToken || !refreshToken || hash.has("error")) return { kind: "invalid", cleanUrl };
  return { kind: "session", cleanUrl, accessToken, refreshToken };
}

export function isVerifiedInvitee(
  user: { email?: string | null; email_confirmed_at?: string | null } | null,
  invitedEmail: string,
) {
  return Boolean(user?.email_confirmed_at
    && user.email?.trim().toLowerCase() === invitedEmail.trim().toLowerCase());
}

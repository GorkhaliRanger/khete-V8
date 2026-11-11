import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";

export const PASSWORD_FLOW_TTL_MS = 15 * 60 * 1000;
export const PASSWORD_FLOW_COOKIE = "khete-admin-password-flow";
export type PasswordFlowIdentity = { id: string; email: string; sessionId: string };
export type PasswordRecoverySession = { access_token: string; refresh_token: string };
export type PasswordRequest = { user_id: string; expires_at: string; consumed_at: string | null };
type Flow = PasswordFlowIdentity & {
  requestId: string;
  expiresAt: number;
  phase: "pending" | "verified";
  verifier?: string;
  recovery?: PasswordRecoverySession;
};

export class PasswordFlowError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export interface PasswordFlowDependencies {
  authenticate(): Promise<PasswordFlowIdentity>;
  secret: string | undefined;
  cookie(): string | undefined;
  writeCookie(value: string, maxAge: number): void;
  clearCookie(): void;
  register(id: string, userId: string, expiresAt: string): Promise<void>;
  request(id: string): Promise<PasswordRequest | null>;
  consume(id: string): Promise<boolean>;
  sendLink(email: string, redirectTo: string): Promise<string>;
  exchangeCode(code: string, verifier: string): Promise<{ user: { id: string; email?: string }; session: PasswordRecoverySession }>;
  changePassword(session: PasswordRecoverySession, password: string): Promise<PasswordRecoverySession>;
  adoptSession(session: PasswordRecoverySession): Promise<boolean>;
  now?: () => number;
}

function key(secret: string | undefined) {
  const result = secret ? Buffer.from(secret, "base64") : Buffer.alloc(0);
  if (result.length !== 32) throw new PasswordFlowError("Email verification is not configured. Contact the site administrator.", 503);
  return result;
}

export function sealPasswordFlow(flow: Flow, secret: string | undefined) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(Buffer.from("khete-admin-password-change-v1"));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(flow), "utf8"), cipher.final()]);
  const sealed = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
  if (sealed.length > 3800) throw new PasswordFlowError("The email verification session is too large to save safely. Contact the site administrator.", 503);
  return sealed;
}

function openFlow(value: string | undefined, secret: string | undefined): Flow | null {
  const encryptionKey = key(secret);
  if (!value || value.length > 4096) return null;
  try {
    const packed = Buffer.from(value, "base64url");
    if (packed.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey, packed.subarray(0, 12));
    decipher.setAAD(Buffer.from("khete-admin-password-change-v1"));
    decipher.setAuthTag(packed.subarray(12, 28));
    const decoded = JSON.parse(Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString("utf8")) as Flow;
    if (!decoded || typeof decoded.id !== "string" || typeof decoded.email !== "string"
      || typeof decoded.sessionId !== "string" || typeof decoded.requestId !== "string"
      || typeof decoded.expiresAt !== "number" || !["pending", "verified"].includes(decoded.phase)) return null;
    if (decoded.phase === "pending" && typeof decoded.verifier !== "string") return null;
    if (decoded.phase === "verified" && (!decoded.recovery || typeof decoded.recovery.access_token !== "string" || typeof decoded.recovery.refresh_token !== "string")) return null;
    return decoded;
  } catch { return null; }
}

function sameIdentity(flow: Flow, user: PasswordFlowIdentity) {
  return flow.id === user.id && flow.email.toLowerCase() === user.email.toLowerCase() && flow.sessionId === user.sessionId;
}

export function validateNewPassword(password: unknown, confirmation: unknown): asserts password is string {
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    throw new PasswordFlowError("Use a password with 8 to 128 characters.");
  }
  if (typeof confirmation !== "string" || password !== confirmation) throw new PasswordFlowError("The new passwords do not match.");
}

export function createPasswordFlowService(deps: PasswordFlowDependencies) {
  const now = deps.now ?? Date.now;
  const clear = () => deps.clearCookie();
  async function validFlow(user: PasswordFlowIdentity) {
    const flow = openFlow(deps.cookie(), deps.secret);
    if (!flow || !sameIdentity(flow, user) || flow.expiresAt <= now()) { clear(); return null; }
    const request = await deps.request(flow.requestId);
    if (!request || request.user_id !== user.id || request.consumed_at || Date.parse(request.expires_at) <= now()) { clear(); return null; }
    return flow;
  }
  function write(flow: Flow) {
    deps.writeCookie(sealPasswordFlow(flow, deps.secret), Math.max(1, Math.ceil((flow.expiresAt - now()) / 1000)));
  }
  return {
    async send(origin: string) {
      const user = await deps.authenticate();
      key(deps.secret);
      const previous = openFlow(deps.cookie(), deps.secret);
      if (previous && sameIdentity(previous, user)) await deps.consume(previous.requestId);
      clear();
      const requestId = randomUUID();
      const expiresAt = now() + PASSWORD_FLOW_TTL_MS;
      await deps.register(requestId, user.id, new Date(expiresAt).toISOString());
      // Reuse the existing recovery redirect. The private PKCE verifier, not a
      // user-controllable URL parameter, binds the link to this browser/flow.
      const verifier = await deps.sendLink(user.email, `${origin}/admin/update-password`);
      write({ ...user, requestId, expiresAt, phase: "pending", verifier });
      return { state: "pending" as const, email: user.email, expiresAt };
    },
    async status() {
      const user = await deps.authenticate();
      const flow = await validFlow(user);
      return flow ? { state: flow.phase, expiresAt: flow.expiresAt } : { state: "none" as const };
    },
    async verify(code: unknown) {
      const user = await deps.authenticate();
      const flow = await validFlow(user);
      if (!flow || flow.phase !== "pending" || !flow.verifier) throw new PasswordFlowError("This verification request has expired. Request a new link from your Admin profile.", 409);
      if (typeof code !== "string" || code.length < 8 || code.length > 2048 || /\s/.test(code)) throw new PasswordFlowError("The verification link is invalid.");
      const verified = await deps.exchangeCode(code, flow.verifier);
      if (verified.user.id !== user.id || verified.user.email?.toLowerCase() !== user.email.toLowerCase()) {
        clear();
        await deps.consume(flow.requestId);
        throw new PasswordFlowError("The verification link belongs to a different account.", 403);
      }
      write({ ...flow, phase: "verified", verifier: undefined, recovery: verified.session });
      return { state: "verified" as const };
    },
    async confirm(password: unknown, confirmation: unknown) {
      validateNewPassword(password, confirmation);
      const user = await deps.authenticate();
      const flow = await validFlow(user);
      if (!flow || flow.phase !== "verified" || !flow.recovery) throw new PasswordFlowError("Verify the email link before changing your password.", 409);
      if (!await deps.consume(flow.requestId)) {
        clear();
        throw new PasswordFlowError("This verification has already been used. Request a new link.", 409);
      }
      // Claim once before the Auth mutation. A failure needs a fresh link;
      // this avoids parallel/replayed requests changing the password twice.
      clear();
      let session: PasswordRecoverySession;
      try { session = await deps.changePassword(flow.recovery, password); }
      catch (error) {
        const detail = error instanceof Error ? error.message : "The password could not be changed.";
        throw new PasswordFlowError(`${detail} Request a new verification link and try again.`);
      }
      let adopted = false;
      try { adopted = await deps.adoptSession(session); } catch { /* password already changed: require a new sign-in */ }
      return { changed: true as const, signInAgain: !adopted };
    },
    async cancel() {
      const user = await deps.authenticate();
      const flow = openFlow(deps.cookie(), deps.secret);
      clear();
      if (flow && sameIdentity(flow, user)) await deps.consume(flow.requestId);
      return { ok: true as const };
    },
  };
}

/**
 * Optional shared-password sign-in for a public demo. The session is a cookie holding an expiry and an
 * HMAC of it, keyed from the password, so it can't be forged without knowing the password and it dies when
 * the password changes. Uses Web Crypto so the same code runs in the proxy (edge) and in server actions.
 * Shortcut: one shared password and no per-user accounts or login rate limit. Use a real auth library
 * (for example Better Auth) before anything beyond a sandbox demo.
 */
export const SESSION_COOKIE = "treasury_session";
export const SESSION_SECONDS = 12 * 60 * 60;

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

async function mac(password: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

/** Constant-time string comparison. */
export function same(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function createSession(password: string, now = Date.now()): Promise<string> {
  const expires = String(now + SESSION_SECONDS * 1000);
  return `${expires}.${await mac(password, expires)}`;
}

/** True when no password is configured, or the cookie is correctly signed and not expired. */
export async function hasSession(password: string | undefined, cookie: string | undefined, now = Date.now()): Promise<boolean> {
  if (!password) return true;
  const [expires, signature] = (cookie ?? "").split(".");
  if (!expires || !signature || !/^\d+$/.test(expires) || Number(expires) < now) return false;
  return same(signature, await mac(password, expires));
}

/**
 * Optional shared-password gate for a public demo. Returns true when no password is configured
 * or the request's HTTP Basic credentials carry it (any username).
 * Shortcut: one shared password, no rate limiting. Use real sign-in before anything beyond a sandbox demo.
 */
export function passes(password: string | undefined, authorization: string | null): boolean {
  if (!password) return true;
  const m = /^Basic (.+)$/.exec(authorization ?? "");
  if (!m) return false;
  let decoded: string;
  try {
    decoded = atob(m[1]);
  } catch {
    return false;
  }
  const given = decoded.slice(decoded.indexOf(":") + 1);
  // Constant-time comparison without node:crypto, because the proxy may run on the edge runtime.
  let diff = given.length ^ password.length;
  for (let i = 0; i < password.length; i++) diff |= (given.charCodeAt(i) || 0) ^ password.charCodeAt(i);
  return diff === 0;
}

/**
 * Nuvion only delivers webhooks to a public https URL. Returns the origin without a trailing slash when it
 * qualifies, or null for http, localhost and private network addresses.
 * Shortcut: a hostname check, not a DNS lookup, so a public name that points at a private address still passes.
 */
export function publicHttpsOrigin(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  const privateV4 = /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(host);
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || privateV4 || host.includes(":") || !host.includes(".")) return null;
  return url.origin;
}

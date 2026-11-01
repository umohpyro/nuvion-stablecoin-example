import "server-only";
import { headers } from "next/headers";

/**
 * This app public address, shown on the setup page as the webhook URL. Priority: an explicit PUBLIC_APP_URL,
 * then the production URL Vercel provides, then the host the request arrived on.
 */
export async function getOrigin(): Promise<string> {
  const configured = process.env.PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

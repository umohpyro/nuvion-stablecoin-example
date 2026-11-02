"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, same, SESSION_COOKIE, SESSION_SECONDS } from "@/lib/gate";

/** Returns an error message on a wrong password, otherwise sets the session cookie and redirects. */
export async function signIn(password: string, next: string): Promise<string> {
  const expected = process.env.DEMO_PASSWORD?.trim();
  if (!expected) redirect("/");
  // A short pause slows down guessing a little; there is no real rate limit (see src/lib/gate.ts).
  await new Promise((r) => setTimeout(r, 600));
  if (!same(password, expected)) return "Wrong password.";
  (await cookies()).set(SESSION_COOKIE, await createSession(expected), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: SESSION_SECONDS, path: "/" });
  // Only follow a same-site path, never an absolute URL.
  redirect(/^\/(?!\/)[\w\-/]*$/.test(next) ? next : "/");
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

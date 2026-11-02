import { NextResponse, type NextRequest } from "next/server";
import { hasSession, SESSION_COOKIE } from "@/lib/gate";

export async function proxy(request: NextRequest) {
  if (await hasSession(process.env.DEMO_PASSWORD?.trim() || undefined, request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

// The webhook route does its own signature check and must stay reachable by Nuvion. /login must stay open to sign in.
export const config = { matcher: ["/((?!api/webhooks/nuvion|login|_next/static|_next/image|favicon.ico).*)"] };

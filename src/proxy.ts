import { NextResponse, type NextRequest } from "next/server";
import { passes } from "@/lib/gate";

export function proxy(request: NextRequest) {
  if (passes(process.env.DEMO_PASSWORD?.trim() || undefined, request.headers.get("authorization"))) return NextResponse.next();
  return new NextResponse("Password required.", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Stablecoin Treasury demo"' } });
}

// The webhook route does its own signature check and must stay reachable by Nuvion.
export const config = { matcher: ["/((?!api/webhooks/nuvion|_next/static|_next/image|favicon.ico).*)"] };

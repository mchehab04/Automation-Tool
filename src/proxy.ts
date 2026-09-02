import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, isSessionTokenValid } from "@/lib/auth/session";

// `middleware.ts` is deprecated in Next 16, renamed to `proxy.ts` (same
// API, different export name) — see node_modules/next/dist/docs/01-app/
// 03-api-reference/03-file-conventions/proxy.md. Proxy defaults to the
// Node.js runtime in this version (not Edge), which is what makes the
// real DB-backed check below cheap enough to do on every mutation.

function isPublicPath(pathname: string) {
  return pathname === "/login";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (isPublicPath(pathname)) {
    if (token && (await isSessionTokenValid(token))) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (request.method === "GET" || request.method === "HEAD") {
    // Optimistic check — matches Next's documented Proxy pattern, avoids a
    // DB round trip on every navigation/prefetch. The real check happens in
    // requireEmployee() (server components) and below (mutations).
    if (!token) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.next();
  }

  // Mutations (Server Action POSTs, every write in this app) get the real
  // check — closes the gap a cookie-presence check alone would leave (a
  // stale/forged cookie value that merely exists but isn't a live session).
  if (!token || !(await isSessionTokenValid(token))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // /api/cron/* (the Gmail-intake cron) authenticates via a CRON_SECRET
  // bearer header, not a session cookie — excluded so Vercel's scheduler
  // isn't redirected to /login. /api/webhooks/* (WhatsApp) is called by
  // Meta's servers and authenticates via its own signature check — same
  // reasoning, a redirect here would break both Meta's verification
  // handshake and every inbound message delivery.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron|api/webhooks).*)"],
};

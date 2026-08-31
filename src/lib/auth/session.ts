import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE_NAME = "session";
const SESSION_DURATION_DAYS = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Opaque token — only its hash is ever stored (see schema.prisma's Session
// comment). The raw token lives solely in the httpOnly cookie.
export async function createSession(employeeId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { employeeId, tokenHash: hashToken(token), expiresAt },
  });

  (await cookies()).set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function clearSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  (await cookies()).delete(SESSION_COOKIE_NAME);
}

// Real, DB-backed lookup — usable from proxy.ts. Proxy defaults to the
// Node.js runtime in this Next version (confirmed via node_modules/next/
// dist/docs), so this is cheap enough to call for real on every mutation.
export async function isSessionTokenValid(token: string): Promise<boolean> {
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
  return Boolean(session) && session!.expiresAt > new Date();
}

// Memoized per request (React's cache()) — safe to call from the layout,
// every page, and any server action without multiplying DB queries; they
// all share the one lookup for a given request.
export const getCurrentEmployee = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { employee: true },
  });
  if (!session || session.expiresAt < new Date()) return null;

  return session.employee;
});

export async function requireEmployee() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login");
  return employee;
}

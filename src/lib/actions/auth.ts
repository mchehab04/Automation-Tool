"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, clearSession } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/validation";

export type LoginState = { error?: string } | undefined;

// Returns an error object rather than throwing, and is called via
// useActionState (not a manual startTransition+try/catch like this app's
// other action-calling components) — redirect() throws Next's internal
// redirect signal, which a hand-written catch block would swallow. This is
// the pattern Next's own auth guide uses for exactly this reason.
export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  const employee = email ? await prisma.employee.findUnique({ where: { email } }) : null;
  if (!employee || !(await verifyPassword(password, employee.passwordHash))) {
    return { error: "Incorrect email or password." };
  }

  await createSession(employee.id);
  redirect("/dashboard");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}

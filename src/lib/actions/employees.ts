"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { requireOwner } from "@/lib/auth/session";
import { MAX_LENGTHS, isValidEmail, isValidPassword, normalizeEmail } from "@/lib/validation";

const DEMO_BUSINESS_ID = "demo-business";

export async function createEmployee(formData: FormData) {
  await requireOwner();

  const name = String(formData.get("name") ?? "").trim().slice(0, MAX_LENGTHS.name);
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!name) {
    throw new Error("Name is required.");
  }
  if (!email || !isValidEmail(email)) {
    throw new Error("A valid email is required.");
  }
  if (!isValidPassword(password)) {
    throw new Error("Password must be at least 8 characters.");
  }

  const existing = await prisma.employee.findUnique({ where: { email } });
  if (existing) {
    throw new Error("An employee with that email already exists.");
  }

  await prisma.employee.create({
    data: {
      businessId: DEMO_BUSINESS_ID,
      name,
      email,
      passwordHash: await hashPassword(password),
    },
  });

  revalidatePath("/settings");
}

export async function updateEmployee(employeeId: string, formData: FormData) {
  await requireOwner();

  const name = String(formData.get("name") ?? "").trim().slice(0, MAX_LENGTHS.name);
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  // Optional — blank means "keep the current password". This is the
  // correct way to handle "an employee forgot their password": the owner
  // sets a new one, rather than viewing the old one (which isn't possible
  // anyway — passwords are hashed one-way, not stored reversibly).
  const newPassword = String(formData.get("password") ?? "");

  if (!name) {
    throw new Error("Name is required.");
  }
  if (!email || !isValidEmail(email)) {
    throw new Error("A valid email is required.");
  }
  if (newPassword && !isValidPassword(newPassword)) {
    throw new Error("New password must be at least 8 characters.");
  }

  const existing = await prisma.employee.findUnique({ where: { email } });
  if (existing && existing.id !== employeeId) {
    throw new Error("An employee with that email already exists.");
  }

  await prisma.employee.update({
    where: { id: employeeId },
    data: {
      name,
      email,
      ...(newPassword ? { passwordHash: await hashPassword(newPassword) } : {}),
    },
  });

  // A password reset should invalidate any session already logged in with
  // the old password — otherwise an already-open browser keeps working
  // until it happens to log out, defeating the point of the reset.
  if (newPassword) {
    await prisma.session.deleteMany({ where: { employeeId } });
  }

  revalidatePath("/settings");
}

export async function deleteEmployee(employeeId: string) {
  await requireOwner();

  const target = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
  if (target.role === "OWNER") {
    throw new Error("The owner account can't be removed.");
  }

  // Sessions cascade-delete with the employee (see schema.prisma), so a
  // removed employee's active session(s) stop working immediately.
  await prisma.employee.delete({ where: { id: employeeId } });
  revalidatePath("/settings");
}

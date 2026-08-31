"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { MAX_LENGTHS, isValidEmail, isValidPassword, normalizeEmail } from "@/lib/validation";

const DEMO_BUSINESS_ID = "demo-business";

export async function createEmployee(formData: FormData) {
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

export async function deleteEmployee(employeeId: string) {
  // Sessions cascade-delete with the employee (see schema.prisma), so a
  // removed employee's active session(s) stop working immediately.
  await prisma.employee.delete({ where: { id: employeeId } });
  revalidatePath("/settings");
}

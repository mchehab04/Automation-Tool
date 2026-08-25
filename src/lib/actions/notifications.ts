"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function getUnreadNotifications() {
  return prisma.notification.findMany({
    where: { read: false },
    include: { lead: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function markNotificationRead(id: string) {
  await prisma.notification.update({ where: { id }, data: { read: true } });
  revalidatePath("/", "layout");
}

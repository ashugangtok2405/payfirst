"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function savePushSubscription(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  const userId = await requireUserId();

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    update: { userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
  });
}

export async function deletePushSubscription(endpoint: string) {
  const userId = await requireUserId();
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
}

export async function updateReminderDays(days: number) {
  const userId = await requireUserId();
  const clamped = Math.min(Math.max(Math.round(days), 0), 30);
  await prisma.user.update({ where: { id: userId }, data: { reminderDaysBefore: clamped } });
  revalidatePath("/dashboard");
}

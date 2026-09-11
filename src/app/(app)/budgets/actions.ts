"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function setBudget(category: string, amount: number) {
  const userId = await requireUserId();

  if (!(amount > 0)) {
    await prisma.budget.deleteMany({ where: { userId, category } });
  } else {
    await prisma.budget.upsert({
      where: { userId_category: { userId, category } },
      create: { userId, category, amount },
      update: { amount },
    });
  }

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
}

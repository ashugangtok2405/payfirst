"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

function parseAccountFields(formData: FormData) {
  return {
    accountName: String(formData.get("accountName") ?? "").trim(),
    bankName: String(formData.get("bankName") ?? "").trim(),
    accountType: String(formData.get("accountType") ?? "savings"),
    last4: String(formData.get("last4") ?? "").trim() || null,
    balance: Number(formData.get("balance") ?? 0),
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createBankAccount(formData: FormData) {
  const userId = await requireUserId();
  const data = parseAccountFields(formData);
  if (!data.accountName || !data.bankName) throw new Error("Account name and bank name are required.");

  await prisma.bankAccount.create({ data: { ...data, userId } });
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function updateBankAccount(id: string, formData: FormData) {
  const userId = await requireUserId();
  const existing = await prisma.bankAccount.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) throw new Error("Not found");

  const data = parseAccountFields(formData);
  await prisma.bankAccount.update({ where: { id }, data });
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function deleteBankAccount(id: string) {
  const userId = await requireUserId();
  const existing = await prisma.bankAccount.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) throw new Error("Not found");

  await prisma.bankAccount.delete({ where: { id } });
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

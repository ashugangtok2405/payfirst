"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createTransaction } from "@/app/(app)/transactions/actions";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

function revalidateAll() {
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
}

function parseGoalFields(formData: FormData) {
  const targetDateRaw = String(formData.get("targetDate") ?? "").trim();
  return {
    name: String(formData.get("name") ?? "").trim(),
    targetAmount: Number(formData.get("targetAmount") ?? 0),
    bankAccountId: String(formData.get("bankAccountId") ?? ""),
    targetDate: targetDateRaw ? new Date(targetDateRaw) : null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

async function assertOwnedBankAccount(id: string, userId: string) {
  const account = await prisma.bankAccount.findUnique({ where: { id } });
  if (!account || account.userId !== userId) throw new Error("Bank account not found.");
  return account;
}

export async function createGoal(formData: FormData) {
  const userId = await requireUserId();
  const data = parseGoalFields(formData);
  if (!data.name) throw new Error("Goal name is required.");
  if (!(data.targetAmount > 0)) throw new Error("Target amount must be greater than zero.");
  await assertOwnedBankAccount(data.bankAccountId, userId);

  await prisma.goal.create({ data: { ...data, userId } });
  revalidateAll();
}

export async function updateGoal(id: string, formData: FormData) {
  const userId = await requireUserId();
  const existing = await prisma.goal.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) throw new Error("Not found");

  const data = parseGoalFields(formData);
  if (!data.name) throw new Error("Goal name is required.");
  if (!(data.targetAmount > 0)) throw new Error("Target amount must be greater than zero.");
  await assertOwnedBankAccount(data.bankAccountId, userId);

  await prisma.goal.update({ where: { id }, data });
  revalidateAll();
}

export async function deleteGoal(id: string) {
  const userId = await requireUserId();
  const existing = await prisma.goal.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) throw new Error("Not found");

  await prisma.goal.delete({ where: { id } });
  revalidateAll();
}

export async function contributeToGoal(goalId: string, formData: FormData) {
  const userId = await requireUserId();
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  if (!goal || goal.userId !== userId) throw new Error("Goal not found.");

  const from = String(formData.get("from") ?? "");
  if (!from) throw new Error("Choose a source account.");
  const amount = String(formData.get("amount") ?? "");
  const date = String(formData.get("date") ?? "");
  const note = String(formData.get("note") ?? "");

  const payload = new FormData();
  payload.set("type", "transfer");
  payload.set("from", `bank:${from}`);
  payload.set("to", `bank:${goal.bankAccountId}`);
  payload.set("amount", amount);
  payload.set("date", date);
  payload.set("note", note);
  payload.set("category", `Goal: ${goal.name}`);
  payload.set("goalId", goalId);

  await createTransaction(payload);
  revalidateAll();
}

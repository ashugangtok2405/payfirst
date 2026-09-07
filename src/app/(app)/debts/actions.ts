"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

function parseDebtFields(formData: FormData) {
  const dueDateRaw = String(formData.get("dueDate") ?? "").trim();
  return {
    personName: String(formData.get("personName") ?? "").trim(),
    direction: String(formData.get("direction") ?? "owed_by_me"),
    amount: Number(formData.get("amount") ?? 0),
    dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createDebt(formData: FormData) {
  const userId = await requireUserId();
  const data = parseDebtFields(formData);
  if (!data.personName) throw new Error("Person name is required.");

  await prisma.debt.create({ data: { ...data, userId } });
  revalidatePath("/debts");
  revalidatePath("/dashboard");
}

export async function updateDebt(id: string, formData: FormData) {
  const userId = await requireUserId();
  const existing = await prisma.debt.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) throw new Error("Not found");

  const data = parseDebtFields(formData);
  await prisma.debt.update({ where: { id }, data });
  revalidatePath("/debts");
  revalidatePath("/dashboard");
}

export async function toggleDebtSettled(id: string, settled: boolean) {
  const userId = await requireUserId();
  const existing = await prisma.debt.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) throw new Error("Not found");

  await prisma.debt.update({ where: { id }, data: { settled } });
  revalidatePath("/debts");
  revalidatePath("/dashboard");
}

export async function deleteDebt(id: string) {
  const userId = await requireUserId();
  const existing = await prisma.debt.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) throw new Error("Not found");

  await prisma.debt.delete({ where: { id } });
  revalidatePath("/debts");
  revalidatePath("/dashboard");
}

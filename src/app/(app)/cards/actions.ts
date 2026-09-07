"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

function clampDay(value: FormDataEntryValue | null, fallback = 1) {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), 1), 31);
}

function parseCardFields(formData: FormData) {
  return {
    cardName: String(formData.get("cardName") ?? "").trim(),
    bankName: String(formData.get("bankName") ?? "").trim(),
    last4: String(formData.get("last4") ?? "").trim() || null,
    creditLimit: Number(formData.get("creditLimit") ?? 0),
    currentBalance: Number(formData.get("currentBalance") ?? 0),
    statementDay: clampDay(formData.get("statementDay"), 1),
    dueDay: clampDay(formData.get("dueDay"), 15),
    minPayment: formData.get("minPayment") ? Number(formData.get("minPayment")) : null,
    apr: formData.get("apr") ? Number(formData.get("apr")) : null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createCreditCard(formData: FormData) {
  const userId = await requireUserId();
  const data = parseCardFields(formData);
  if (!data.cardName || !data.bankName) throw new Error("Card name and bank name are required.");

  await prisma.creditCard.create({ data: { ...data, userId } });
  revalidatePath("/cards");
  revalidatePath("/dashboard");
}

export async function updateCreditCard(id: string, formData: FormData) {
  const userId = await requireUserId();
  const existing = await prisma.creditCard.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) throw new Error("Not found");

  const data = parseCardFields(formData);
  await prisma.creditCard.update({ where: { id }, data });
  revalidatePath("/cards");
  revalidatePath("/dashboard");
}

export async function deleteCreditCard(id: string) {
  const userId = await requireUserId();
  const existing = await prisma.creditCard.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) throw new Error("Not found");

  await prisma.creditCard.delete({ where: { id } });
  revalidatePath("/cards");
  revalidatePath("/dashboard");
}

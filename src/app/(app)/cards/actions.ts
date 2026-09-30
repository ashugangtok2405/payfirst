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

export async function setCardDueDate(id: string, dateStr: string) {
  const userId = await requireUserId();
  const existing = await prisma.creditCard.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) throw new Error("Not found");
  if (!dateStr) throw new Error("Choose a date.");

  await prisma.creditCard.update({ where: { id }, data: { nextDueDate: new Date(dateStr) } });
  revalidatePath("/cards");
  revalidatePath("/dashboard");
}

// The simple "Pay" flow (as opposed to the advanced Statement-based Pay):
// logs a plain bank/card -> card transfer and, since paying is what a user
// does to close out a billing cycle, advances the due date a month so the
// dashboard doesn't nag about a bill they just paid.
export async function payCard(cardId: string, formData: FormData) {
  const userId = await requireUserId();
  const card = await prisma.creditCard.findUnique({ where: { id: cardId } });
  if (!card || card.userId !== userId) throw new Error("Not found");

  const from = String(formData.get("from") ?? "");
  const amount = String(formData.get("amount") ?? "");
  const date = String(formData.get("date") ?? "");
  const note = String(formData.get("note") ?? "");

  const payload = new FormData();
  payload.set("type", "transfer");
  payload.set("from", from);
  payload.set("to", `card:${cardId}`);
  payload.set("amount", amount);
  payload.set("date", date);
  payload.set("note", note);

  await createTransaction(payload);

  const base = card.nextDueDate ?? new Date();
  const advanced = new Date(base.getFullYear(), base.getMonth() + 1, base.getDate());
  await prisma.creditCard.update({ where: { id: cardId }, data: { nextDueDate: advanced } });

  revalidatePath("/cards");
  revalidatePath("/dashboard");
}

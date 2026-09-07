"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

function clampDayOrNull(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(Math.round(n), 1), 31);
}

function parseFundFields(formData: FormData) {
  return {
    fundName: String(formData.get("fundName") ?? "").trim(),
    fundHouse: String(formData.get("fundHouse") ?? "").trim() || null,
    folioNumber: String(formData.get("folioNumber") ?? "").trim() || null,
    category: String(formData.get("category") ?? "").trim() || null,
    units: formData.get("units") ? Number(formData.get("units")) : null,
    investedValue: Number(formData.get("investedValue") ?? 0),
    currentValue: Number(formData.get("currentValue") ?? 0),
    sipAmount: formData.get("sipAmount") ? Number(formData.get("sipAmount")) : null,
    sipDueDay: clampDayOrNull(formData.get("sipDueDay")),
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createMutualFund(formData: FormData) {
  const userId = await requireUserId();
  const data = parseFundFields(formData);
  if (!data.fundName) throw new Error("Fund name is required.");

  await prisma.mutualFund.create({ data: { ...data, userId } });
  revalidatePath("/mutual-funds");
  revalidatePath("/dashboard");
}

export async function updateMutualFund(id: string, formData: FormData) {
  const userId = await requireUserId();
  const existing = await prisma.mutualFund.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) throw new Error("Not found");

  const data = parseFundFields(formData);
  await prisma.mutualFund.update({ where: { id }, data });
  revalidatePath("/mutual-funds");
  revalidatePath("/dashboard");
}

export async function deleteMutualFund(id: string) {
  const userId = await requireUserId();
  const existing = await prisma.mutualFund.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) throw new Error("Not found");

  await prisma.mutualFund.delete({ where: { id } });
  revalidatePath("/mutual-funds");
  revalidatePath("/dashboard");
}

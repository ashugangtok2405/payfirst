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

function parseLoanFields(formData: FormData) {
  const startDateRaw = String(formData.get("startDate") ?? "").trim();
  return {
    loanName: String(formData.get("loanName") ?? "").trim(),
    lender: String(formData.get("lender") ?? "").trim(),
    loanType: String(formData.get("loanType") ?? "personal"),
    principal: Number(formData.get("principal") ?? 0),
    outstanding: Number(formData.get("outstanding") ?? 0),
    interestRate: formData.get("interestRate") ? Number(formData.get("interestRate")) : null,
    emiAmount: formData.get("emiAmount") ? Number(formData.get("emiAmount")) : null,
    emiDueDay: clampDay(formData.get("emiDueDay"), 5),
    startDate: startDateRaw ? new Date(startDateRaw) : null,
    tenureMonths: formData.get("tenureMonths") ? Number(formData.get("tenureMonths")) : null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createLoan(formData: FormData) {
  const userId = await requireUserId();
  const data = parseLoanFields(formData);
  if (!data.loanName || !data.lender) throw new Error("Loan name and lender are required.");

  await prisma.loan.create({ data: { ...data, userId } });
  revalidatePath("/loans");
  revalidatePath("/dashboard");
}

export async function updateLoan(id: string, formData: FormData) {
  const userId = await requireUserId();
  const existing = await prisma.loan.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) throw new Error("Not found");

  const data = parseLoanFields(formData);
  await prisma.loan.update({ where: { id }, data });
  revalidatePath("/loans");
  revalidatePath("/dashboard");
}

export async function deleteLoan(id: string) {
  const userId = await requireUserId();
  const existing = await prisma.loan.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) throw new Error("Not found");

  await prisma.loan.delete({ where: { id } });
  revalidatePath("/loans");
  revalidatePath("/dashboard");
}

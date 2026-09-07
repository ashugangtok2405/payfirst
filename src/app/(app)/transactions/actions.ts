"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { TRANSFER_LABELS } from "@/lib/transactions";
import type { Prisma } from "@prisma/client";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

function revalidateAll() {
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  revalidatePath("/cards");
  revalidatePath("/loans");
  revalidatePath("/mutual-funds");
}

async function assertOwnedBankAccount(id: string, userId: string) {
  const account = await prisma.bankAccount.findUnique({ where: { id } });
  if (!account || account.userId !== userId) throw new Error("Bank account not found.");
  return account;
}

async function assertOwnedTarget(type: string, id: string, userId: string) {
  if (type === "bank") return assertOwnedBankAccount(id, userId);
  if (type === "card") {
    const card = await prisma.creditCard.findUnique({ where: { id } });
    if (!card || card.userId !== userId) throw new Error("Credit card not found.");
    return card;
  }
  if (type === "loan") {
    const loan = await prisma.loan.findUnique({ where: { id } });
    if (!loan || loan.userId !== userId) throw new Error("Loan not found.");
    return loan;
  }
  if (type === "fund") {
    const fund = await prisma.mutualFund.findUnique({ where: { id } });
    if (!fund || fund.userId !== userId) throw new Error("Mutual fund not found.");
    return fund;
  }
  throw new Error("Invalid account type.");
}

function applyTargetDelta(type: string, id: string, amount: number): Prisma.PrismaPromise<unknown> {
  if (type === "bank") {
    return prisma.bankAccount.update({ where: { id }, data: { balance: { increment: amount } } });
  }
  if (type === "card") {
    return prisma.creditCard.update({ where: { id }, data: { currentBalance: { decrement: amount } } });
  }
  if (type === "loan") {
    return prisma.loan.update({ where: { id }, data: { outstanding: { decrement: amount } } });
  }
  if (type === "fund") {
    return prisma.mutualFund.update({
      where: { id },
      data: { investedValue: { increment: amount }, currentValue: { increment: amount } },
    });
  }
  throw new Error("Invalid account type.");
}

export async function createTransaction(formData: FormData) {
  const userId = await requireUserId();
  const type = String(formData.get("type") ?? "expense");
  const amount = Number(formData.get("amount") ?? 0);
  const dateRaw = String(formData.get("date") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  const date = dateRaw ? new Date(dateRaw) : new Date();

  if (!(amount > 0)) throw new Error("Amount must be greater than zero.");

  if (type === "expense") {
    const bankAccountId = String(formData.get("bankAccountId") ?? "");
    const category = String(formData.get("category") ?? "Other");
    await assertOwnedBankAccount(bankAccountId, userId);

    await prisma.$transaction([
      prisma.transaction.create({
        data: { userId, type, amount, date, category, note, fromAccountType: "bank", fromAccountId: bankAccountId },
      }),
      prisma.bankAccount.update({ where: { id: bankAccountId }, data: { balance: { decrement: amount } } }),
    ]);
  } else if (type === "income") {
    const bankAccountId = String(formData.get("bankAccountId") ?? "");
    const category = String(formData.get("category") ?? "Other");
    await assertOwnedBankAccount(bankAccountId, userId);

    await prisma.$transaction([
      prisma.transaction.create({
        data: { userId, type, amount, date, category, note, toAccountType: "bank", toAccountId: bankAccountId },
      }),
      prisma.bankAccount.update({ where: { id: bankAccountId }, data: { balance: { increment: amount } } }),
    ]);
  } else if (type === "transfer") {
    const fromAccountId = String(formData.get("fromAccountId") ?? "");
    const [toAccountType, toAccountId] = String(formData.get("to") ?? "").split(":");
    if (!toAccountType || !toAccountId) throw new Error("Choose a destination.");
    if (toAccountType === "bank" && fromAccountId === toAccountId) {
      throw new Error("Source and destination must be different.");
    }

    await assertOwnedBankAccount(fromAccountId, userId);
    await assertOwnedTarget(toAccountType, toAccountId, userId);
    const category = TRANSFER_LABELS[toAccountType] ?? "Transfer";

    await prisma.$transaction([
      prisma.transaction.create({
        data: {
          userId,
          type,
          amount,
          date,
          category,
          note,
          fromAccountType: "bank",
          fromAccountId,
          toAccountType,
          toAccountId,
        },
      }),
      prisma.bankAccount.update({ where: { id: fromAccountId }, data: { balance: { decrement: amount } } }),
      applyTargetDelta(toAccountType, toAccountId, amount),
    ]);
  } else {
    throw new Error("Invalid transaction type.");
  }

  revalidateAll();
}

export async function deleteTransaction(id: string) {
  const userId = await requireUserId();
  const txn = await prisma.transaction.findUnique({ where: { id } });
  if (!txn || txn.userId !== userId) throw new Error("Not found");

  const ops: Prisma.PrismaPromise<unknown>[] = [prisma.transaction.delete({ where: { id } })];

  if (txn.type === "expense" && txn.fromAccountId) {
    ops.push(prisma.bankAccount.update({ where: { id: txn.fromAccountId }, data: { balance: { increment: txn.amount } } }));
  } else if (txn.type === "income" && txn.toAccountId) {
    ops.push(prisma.bankAccount.update({ where: { id: txn.toAccountId }, data: { balance: { decrement: txn.amount } } }));
  } else if (txn.type === "transfer" && txn.fromAccountId && txn.toAccountType && txn.toAccountId) {
    ops.push(prisma.bankAccount.update({ where: { id: txn.fromAccountId }, data: { balance: { increment: txn.amount } } }));
    ops.push(applyTargetDelta(txn.toAccountType, txn.toAccountId, -txn.amount));
  }

  await prisma.$transaction(ops);
  revalidateAll();
}

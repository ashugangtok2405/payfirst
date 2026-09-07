"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { TRANSFER_LABELS } from "@/lib/transactions";
import type { Prisma, Transaction } from "@prisma/client";

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

type TransactionData = {
  type: string;
  amount: number;
  date: Date;
  category: string | null;
  note: string | null;
  fromAccountType: string | null;
  fromAccountId: string | null;
  toAccountType: string | null;
  toAccountId: string | null;
};

async function buildEffect(
  formData: FormData,
  userId: string
): Promise<{ data: TransactionData; ops: Prisma.PrismaPromise<unknown>[] }> {
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
    return {
      data: {
        type,
        amount,
        date,
        note,
        category,
        fromAccountType: "bank",
        fromAccountId: bankAccountId,
        toAccountType: null,
        toAccountId: null,
      },
      ops: [prisma.bankAccount.update({ where: { id: bankAccountId }, data: { balance: { decrement: amount } } })],
    };
  }

  if (type === "income") {
    const bankAccountId = String(formData.get("bankAccountId") ?? "");
    const category = String(formData.get("category") ?? "Other");
    await assertOwnedBankAccount(bankAccountId, userId);
    return {
      data: {
        type,
        amount,
        date,
        note,
        category,
        fromAccountType: null,
        fromAccountId: null,
        toAccountType: "bank",
        toAccountId: bankAccountId,
      },
      ops: [prisma.bankAccount.update({ where: { id: bankAccountId }, data: { balance: { increment: amount } } })],
    };
  }

  if (type === "transfer") {
    const fromAccountId = String(formData.get("fromAccountId") ?? "");
    const [toAccountType, toAccountId] = String(formData.get("to") ?? "").split(":");
    if (!toAccountType || !toAccountId) throw new Error("Choose a destination.");
    if (toAccountType === "bank" && fromAccountId === toAccountId) {
      throw new Error("Source and destination must be different.");
    }
    await assertOwnedBankAccount(fromAccountId, userId);
    await assertOwnedTarget(toAccountType, toAccountId, userId);
    const category = TRANSFER_LABELS[toAccountType] ?? "Transfer";

    return {
      data: { type, amount, date, note, category, fromAccountType: "bank", fromAccountId, toAccountType, toAccountId },
      ops: [
        prisma.bankAccount.update({ where: { id: fromAccountId }, data: { balance: { decrement: amount } } }),
        applyTargetDelta(toAccountType, toAccountId, amount),
      ],
    };
  }

  throw new Error("Invalid transaction type.");
}

function reverseEffect(txn: Transaction): Prisma.PrismaPromise<unknown>[] {
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  if (txn.type === "expense" && txn.fromAccountId) {
    ops.push(prisma.bankAccount.update({ where: { id: txn.fromAccountId }, data: { balance: { increment: txn.amount } } }));
  } else if (txn.type === "income" && txn.toAccountId) {
    ops.push(prisma.bankAccount.update({ where: { id: txn.toAccountId }, data: { balance: { decrement: txn.amount } } }));
  } else if (txn.type === "transfer" && txn.fromAccountId && txn.toAccountType && txn.toAccountId) {
    ops.push(prisma.bankAccount.update({ where: { id: txn.fromAccountId }, data: { balance: { increment: txn.amount } } }));
    ops.push(applyTargetDelta(txn.toAccountType, txn.toAccountId, -txn.amount));
  }
  return ops;
}

export async function createTransaction(formData: FormData) {
  const userId = await requireUserId();
  const { data, ops } = await buildEffect(formData, userId);

  await prisma.$transaction([prisma.transaction.create({ data: { ...data, userId } }), ...ops]);
  revalidateAll();
}

export async function updateTransaction(id: string, formData: FormData) {
  const userId = await requireUserId();
  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) throw new Error("Not found");

  const reverseOps = reverseEffect(existing);
  const { data, ops } = await buildEffect(formData, userId);

  await prisma.$transaction([...reverseOps, prisma.transaction.update({ where: { id }, data }), ...ops]);
  revalidateAll();
}

export async function deleteTransaction(id: string) {
  const userId = await requireUserId();
  const txn = await prisma.transaction.findUnique({ where: { id } });
  if (!txn || txn.userId !== userId) throw new Error("Not found");

  await prisma.$transaction([...reverseEffect(txn), prisma.transaction.delete({ where: { id } })]);
  revalidateAll();
}

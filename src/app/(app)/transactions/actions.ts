"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { deriveTransferCategory } from "@/lib/transactions";
import { formatMoney } from "@/lib/format";
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
  revalidatePath("/goals");
}

async function assertOwnedAccount(type: string, id: string, userId: string) {
  if (type === "bank") {
    const account = await prisma.bankAccount.findUnique({ where: { id } });
    if (!account || account.userId !== userId) throw new Error("Bank account not found.");
    return account;
  }
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

type FundsCheckAccount = {
  balance?: number;
  accountName?: string;
  creditLimit?: number;
  currentBalance?: number;
  cardName?: string;
};

// Only bank accounts and credit cards can be a transfer source, so only those
// need a funds check - a bank can't overdraw, a card can't exceed its limit.
// (Accepts `unknown` because the caller's account record is one of several
// Prisma model types depending on `type`, which TS can't narrow automatically.)
function assertSufficientFunds(type: string, accountRecord: unknown, amount: number) {
  const account = accountRecord as FundsCheckAccount;
  if (type === "bank") {
    const available = account.balance ?? 0;
    if (available < amount) {
      throw new Error(`Insufficient funds — ${account.accountName} only has ${formatMoney(available)} available.`);
    }
  } else if (type === "card") {
    const available = (account.creditLimit ?? 0) - (account.currentBalance ?? 0);
    if (available < amount) {
      throw new Error(`Insufficient credit limit — ${account.cardName} only has ${formatMoney(available)} available.`);
    }
  }
}

// Applies (or, given a negated amount, reverses) the balance effect of `amount`
// moving through an account as either its "source" or "destination" in a
// transaction. Only bank accounts and credit cards can act as a source -
// loans and mutual funds are destination-only (EMI paydown / investment).
function moveDelta(type: string, id: string, amount: number, role: "source" | "destination"): Prisma.PrismaPromise<unknown> {
  if (type === "bank") {
    const delta = role === "source" ? -amount : amount;
    return prisma.bankAccount.update({ where: { id }, data: { balance: { increment: delta } } });
  }
  if (type === "card") {
    // As a source (cash advance) the card owes more; as a destination (bill payment) it owes less.
    const delta = role === "source" ? amount : -amount;
    return prisma.creditCard.update({ where: { id }, data: { currentBalance: { increment: delta } } });
  }
  if (type === "loan") {
    if (role !== "destination") throw new Error("A loan can only be a transfer destination.");
    return prisma.loan.update({ where: { id }, data: { outstanding: { increment: -amount } } });
  }
  if (type === "fund") {
    if (role !== "destination") throw new Error("A mutual fund can only be a transfer destination.");
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
  goalId?: string | null;
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
    await assertOwnedAccount("bank", bankAccountId, userId);
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
      ops: [moveDelta("bank", bankAccountId, amount, "source")],
    };
  }

  if (type === "income") {
    const bankAccountId = String(formData.get("bankAccountId") ?? "");
    const category = String(formData.get("category") ?? "Other");
    await assertOwnedAccount("bank", bankAccountId, userId);
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
      ops: [moveDelta("bank", bankAccountId, amount, "destination")],
    };
  }

  if (type === "transfer") {
    const [fromAccountType, fromAccountId] = String(formData.get("from") ?? "").split(":");
    const [toAccountType, toAccountId] = String(formData.get("to") ?? "").split(":");
    if (!fromAccountType || !fromAccountId) throw new Error("Choose a source.");
    if (!toAccountType || !toAccountId) throw new Error("Choose a destination.");
    if (fromAccountType === toAccountType && fromAccountId === toAccountId) {
      throw new Error("Source and destination must be different.");
    }

    const fromAccount = await assertOwnedAccount(fromAccountType, fromAccountId, userId);
    await assertOwnedAccount(toAccountType, toAccountId, userId);
    assertSufficientFunds(fromAccountType, fromAccount, amount);
    const category = String(formData.get("category") ?? "") || deriveTransferCategory(fromAccountType, toAccountType);

    const data: TransactionData = { type, amount, date, note, category, fromAccountType, fromAccountId, toAccountType, toAccountId };
    if (formData.has("goalId")) {
      data.goalId = String(formData.get("goalId") ?? "") || null;
    }

    return {
      data,
      ops: [
        moveDelta(fromAccountType, fromAccountId, amount, "source"),
        moveDelta(toAccountType, toAccountId, amount, "destination"),
      ],
    };
  }

  throw new Error("Invalid transaction type.");
}

function reverseEffect(txn: Transaction): Prisma.PrismaPromise<unknown>[] {
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  if (txn.fromAccountType && txn.fromAccountId) {
    ops.push(moveDelta(txn.fromAccountType, txn.fromAccountId, -txn.amount, "source"));
  }
  if (txn.toAccountType && txn.toAccountId) {
    ops.push(moveDelta(txn.toAccountType, txn.toAccountId, -txn.amount, "destination"));
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

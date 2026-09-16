"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { previousOccurrenceForDay, nextOccurrenceForDay, todayInAppTimeZone } from "@/lib/dueDates";
import { remainingDueOf } from "@/lib/creditCardStatements";
import { createTransaction } from "@/app/(app)/transactions/actions";
import type { Transaction } from "@prisma/client";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

function revalidateAll() {
  revalidatePath("/cards");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
}

// Is this transaction a charge (purchase-like, increases the bill) or a
// credit (refund-like, decreases the bill) for the given card? Payments
// (transfers INTO the card) are deliberately excluded - those settle a
// statement rather than belong to one, tracked via CreditCardPayment.
function classifyForStatement(txn: Transaction, cardId: string): "charge" | "credit" | null {
  if (txn.fromAccountType === "card" && txn.fromAccountId === cardId && (txn.type === "expense" || txn.type === "transfer")) {
    return "charge";
  }
  if (txn.toAccountType === "card" && txn.toAccountId === cardId && txn.type === "income") {
    return "credit";
  }
  return null;
}

function sumEligible(transactions: Transaction[], cardId: string) {
  let purchaseTotal = 0;
  let refundTotal = 0;
  for (const txn of transactions) {
    const kind = classifyForStatement(txn, cardId);
    if (kind === "charge") purchaseTotal += txn.amount;
    else if (kind === "credit") refundTotal += txn.amount;
  }
  return { purchaseTotal, refundTotal };
}

async function assertOwnedCard(cardId: string, userId: string) {
  const card = await prisma.creditCard.findUnique({ where: { id: cardId } });
  if (!card || card.userId !== userId) throw new Error("Credit card not found.");
  return card;
}

export async function generateStatement(cardId: string) {
  const userId = await requireUserId();
  const card = await assertOwnedCard(cardId, userId);

  const today = todayInAppTimeZone();
  const periodEnd = previousOccurrenceForDay(card.statementDay, today);
  const priorStatementDate = previousOccurrenceForDay(card.statementDay, periodEnd);
  const periodStart = new Date(priorStatementDate.getFullYear(), priorStatementDate.getMonth(), priorStatementDate.getDate() + 1);

  const existing = await prisma.creditCardStatement.findUnique({
    where: { cardId_periodEnd: { cardId, periodEnd } },
  });
  if (existing) return existing;

  const [backlog, periodTxns, previousStatement] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        userId,
        statementId: null,
        date: { lt: periodStart },
        OR: [
          { fromAccountType: "card", fromAccountId: cardId },
          { toAccountType: "card", toAccountId: cardId },
        ],
      },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        statementId: null,
        date: { gte: periodStart, lte: periodEnd },
        OR: [
          { fromAccountType: "card", fromAccountId: cardId },
          { toAccountType: "card", toAccountId: cardId },
        ],
      },
    }),
    prisma.creditCardStatement.findFirst({
      where: { cardId },
      orderBy: { periodEnd: "desc" },
      include: { payments: { include: { transaction: true } } },
    }),
  ]);

  const backlogSums = sumEligible(backlog, cardId);
  const openingBalance =
    (previousStatement ? remainingDueOf(previousStatement) : 0) + backlogSums.purchaseTotal - backlogSums.refundTotal;

  const { purchaseTotal, refundTotal } = sumEligible(periodTxns, cardId);
  const feeTotal = 0;
  const interestTotal = 0;
  const statementTotal = openingBalance + purchaseTotal + feeTotal + interestTotal - refundTotal;
  const minimumDue = card.minPayment ?? Math.round(statementTotal * 0.05);
  const dueDate = nextOccurrenceForDay(card.dueDay, periodEnd);

  const includedIds = [...backlog, ...periodTxns].map((t) => t.id);

  const statement = await prisma.$transaction(async (tx) => {
    const created = await tx.creditCardStatement.create({
      data: {
        userId,
        cardId,
        periodStart,
        periodEnd,
        statementDate: periodEnd,
        dueDate,
        openingBalance,
        purchaseTotal,
        refundTotal,
        feeTotal,
        interestTotal,
        statementTotal,
        minimumDue,
        finalizedAt: new Date(),
      },
    });
    if (includedIds.length > 0) {
      await tx.transaction.updateMany({
        where: { id: { in: includedIds } },
        data: { statementId: created.id },
      });
    }
    return created;
  });

  revalidateAll();
  return statement;
}

export async function updateStatement(statementId: string, formData: FormData) {
  const userId = await requireUserId();
  const existing = await prisma.creditCardStatement.findUnique({ where: { id: statementId } });
  if (!existing || existing.userId !== userId) throw new Error("Not found");

  const statementTotal = Number(formData.get("statementTotal") ?? existing.statementTotal);
  const minimumDue = Number(formData.get("minimumDue") ?? existing.minimumDue);
  const dueDateRaw = String(formData.get("dueDate") ?? "");

  await prisma.creditCardStatement.update({
    where: { id: statementId },
    data: {
      statementTotal,
      minimumDue,
      dueDate: dueDateRaw ? new Date(dueDateRaw) : existing.dueDate,
      isManual: true,
    },
  });
  revalidateAll();
}

export async function payStatement(formData: FormData) {
  const userId = await requireUserId();
  const cardId = String(formData.get("cardId") ?? "");
  await assertOwnedCard(cardId, userId);

  const statementId = String(formData.get("statementId") ?? "") || null;
  if (statementId) {
    const statement = await prisma.creditCardStatement.findUnique({ where: { id: statementId } });
    if (!statement || statement.userId !== userId || statement.cardId !== cardId) {
      throw new Error("Statement not found.");
    }
  }

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

  const transaction = await createTransaction(payload);

  await prisma.creditCardPayment.create({
    data: { userId, cardId, statementId, transactionId: transaction.id },
  });

  revalidateAll();
}

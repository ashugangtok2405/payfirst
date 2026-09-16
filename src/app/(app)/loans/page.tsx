import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { previousOccurrenceForDay, nextOccurrenceForDay } from "@/lib/dueDates";
import LoansManager from "./LoansManager";

export default async function LoansPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [loans, bankAccounts, cards, payments] = await Promise.all([
    prisma.loan.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.bankAccount.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.creditCard.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.transaction.findMany({
      where: { userId, type: "transfer", toAccountType: "loan" },
      select: { toAccountId: true, date: true },
    }),
  ]);

  const paidByLoan: Record<string, boolean> = {};
  for (const loan of loans) {
    const cycleEnd = nextOccurrenceForDay(loan.emiDueDay);
    const cycleStart = previousOccurrenceForDay(loan.emiDueDay);
    paidByLoan[loan.id] = payments.some(
      (p) => p.toAccountId === loan.id && p.date > cycleStart && p.date <= cycleEnd
    );
  }

  return <LoansManager loans={loans} bankAccounts={bankAccounts} cards={cards} paidByLoan={paidByLoan} />;
}

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { previousOccurrenceForDay, nextOccurrenceForDay } from "@/lib/dueDates";
import CardsManager from "./CardsManager";

export default async function CardsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [cards, bankAccounts, payments] = await Promise.all([
    prisma.creditCard.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.bankAccount.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.transaction.findMany({
      where: { userId, type: "transfer", toAccountType: "card" },
      select: { toAccountId: true, date: true },
    }),
  ]);

  const paidByCard: Record<string, boolean> = {};
  for (const card of cards) {
    const cycleEnd = nextOccurrenceForDay(card.dueDay);
    const cycleStart = previousOccurrenceForDay(card.dueDay);
    paidByCard[card.id] = payments.some(
      (p) => p.toAccountId === card.id && p.date > cycleStart && p.date <= cycleEnd
    );
  }

  return <CardsManager cards={cards} bankAccounts={bankAccounts} paidByCard={paidByCard} />;
}

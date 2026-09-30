import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CardsManager from "./CardsManager";

export default async function CardsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [cards, bankAccounts, statements] = await Promise.all([
    prisma.creditCard.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.bankAccount.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.creditCardStatement.findMany({
      where: { userId },
      orderBy: { periodEnd: "desc" },
      include: { payments: { include: { transaction: true } } },
    }),
  ]);

  const statementsByCard: Record<string, typeof statements> = {};
  for (const statement of statements) {
    (statementsByCard[statement.cardId] ??= []).push(statement);
  }

  return <CardsManager cards={cards} bankAccounts={bankAccounts} statementsByCard={statementsByCard} />;
}

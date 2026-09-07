import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TransactionsManager from "./TransactionsManager";

export default async function TransactionsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [transactions, bankAccounts, cards, loans, funds] = await Promise.all([
    prisma.transaction.findMany({ where: { userId }, orderBy: { date: "desc" } }),
    prisma.bankAccount.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.creditCard.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.loan.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.mutualFund.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <TransactionsManager
      transactions={transactions}
      bankAccounts={bankAccounts}
      cards={cards}
      loans={loans}
      funds={funds}
    />
  );
}

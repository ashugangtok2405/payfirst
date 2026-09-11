import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, mergeCategories } from "@/lib/transactions";
import TransactionsManager from "./TransactionsManager";

export default async function TransactionsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [transactions, bankAccounts, cards, loans, funds, expenseCatRows, incomeCatRows, budgetRows] = await Promise.all([
    prisma.transaction.findMany({ where: { userId }, orderBy: { date: "desc" } }),
    prisma.bankAccount.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.creditCard.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.loan.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.mutualFund.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.transaction.findMany({ where: { userId, type: "expense" }, distinct: ["category"], select: { category: true } }),
    prisma.transaction.findMany({ where: { userId, type: "income" }, distinct: ["category"], select: { category: true } }),
    prisma.budget.findMany({ where: { userId }, select: { category: true } }),
  ]);

  const expenseCategories = mergeCategories(EXPENSE_CATEGORIES, [
    ...expenseCatRows.map((r) => r.category ?? ""),
    ...budgetRows.map((r) => r.category),
  ]);
  const incomeCategories = mergeCategories(
    INCOME_CATEGORIES,
    incomeCatRows.map((r) => r.category ?? "")
  );

  return (
    <TransactionsManager
      transactions={transactions}
      bankAccounts={bankAccounts}
      cards={cards}
      loans={loans}
      funds={funds}
      expenseCategories={expenseCategories}
      incomeCategories={incomeCategories}
    />
  );
}

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, mergeCategories } from "@/lib/transactions";
import { todayInAppTimeZone, parseMonthParam, monthParamFor } from "@/lib/dueDates";
import TransactionsManager from "./TransactionsManager";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;

  const { month: monthParam } = await searchParams;
  const today = todayInAppTimeZone();
  const { year, month } = parseMonthParam(monthParam, today);
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const [transactions, bankAccounts, cards, loans, funds, expenseCatRows, incomeCatRows, budgetRows] = await Promise.all([
    prisma.transaction.findMany({ where: { userId, date: { gte: monthStart, lt: monthEnd } }, orderBy: { date: "desc" } }),
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

  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);

  const spentByCategory = new Map<string, number>();
  for (const txn of transactions) {
    if (txn.type !== "expense") continue;
    const key = txn.category ?? "Other";
    spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + txn.amount);
  }
  const categoryBreakdown = [...spentByCategory.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const monthLabel = monthStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <TransactionsManager
      transactions={transactions}
      bankAccounts={bankAccounts}
      cards={cards}
      loans={loans}
      funds={funds}
      expenseCategories={expenseCategories}
      incomeCategories={incomeCategories}
      monthSummary={{
        monthLabel,
        isCurrentMonth,
        prevHref: `/transactions?month=${monthParamFor(year, month - 1)}`,
        nextHref: `/transactions?month=${monthParamFor(year, month + 1)}`,
        currentHref: "/transactions",
        totalExpense,
        totalIncome,
        categoryBreakdown,
      }}
    />
  );
}

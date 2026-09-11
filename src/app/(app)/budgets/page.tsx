import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { todayInAppTimeZone, parseMonthParam, monthParamFor } from "@/lib/dueDates";
import { EXPENSE_CATEGORIES, mergeCategories } from "@/lib/transactions";
import BudgetsManager from "./BudgetsManager";

export default async function BudgetsPage({
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

  const [budgets, monthExpenses, allExpenseCatRows] = await Promise.all([
    prisma.budget.findMany({ where: { userId } }),
    prisma.transaction.findMany({
      where: { userId, type: "expense", date: { gte: monthStart, lt: monthEnd } },
      select: { category: true, amount: true },
    }),
    prisma.transaction.findMany({ where: { userId, type: "expense" }, distinct: ["category"], select: { category: true } }),
  ]);

  const spentByCategory = new Map<string, number>();
  for (const txn of monthExpenses) {
    const key = txn.category ?? "Other";
    spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + txn.amount);
  }

  const budgetByCategory = new Map(budgets.map((b) => [b.category, b.amount]));

  const allCategories = mergeCategories(EXPENSE_CATEGORIES, [
    ...allExpenseCatRows.map((r) => r.category ?? ""),
    ...budgets.map((b) => b.category),
  ]);

  const rows = allCategories.map((category) => ({
    category,
    budget: budgetByCategory.get(category) ?? null,
    spent: spentByCategory.get(category) ?? 0,
  }));

  const monthLabel = monthStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const prevHref = `/budgets?month=${monthParamFor(year, month - 1)}`;
  const nextHref = `/budgets?month=${monthParamFor(year, month + 1)}`;
  const currentHref = "/budgets";

  return (
    <BudgetsManager
      rows={rows}
      allCategories={allCategories}
      monthLabel={monthLabel}
      isCurrentMonth={isCurrentMonth}
      prevHref={prevHref}
      nextHref={nextHref}
      currentHref={currentHref}
    />
  );
}

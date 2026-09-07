import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { nextOccurrenceForDay, daysUntil, urgencyFromDays, urgencyStyles, urgencyLabels, type Urgency } from "@/lib/dueDates";

type DueItem = {
  key: string;
  label: string;
  detail: string;
  amount: number;
  dueDate: Date;
  days: number;
  urgency: Urgency;
  href: string;
};

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [accounts, cards, loans, funds, debts] = await Promise.all([
    prisma.bankAccount.findMany({ where: { userId } }),
    prisma.creditCard.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId } }),
    prisma.mutualFund.findMany({ where: { userId } }),
    prisma.debt.findMany({ where: { userId, settled: false } }),
  ]);

  const dueItems: DueItem[] = [];

  for (const card of cards) {
    const dueDate = nextOccurrenceForDay(card.dueDay);
    const days = daysUntil(dueDate);
    dueItems.push({
      key: `card-${card.id}`,
      label: card.cardName,
      detail: `${card.bankName} credit card payment`,
      amount: card.minPayment ?? card.currentBalance,
      dueDate,
      days,
      urgency: urgencyFromDays(days),
      href: "/cards",
    });
  }

  for (const loan of loans) {
    const dueDate = nextOccurrenceForDay(loan.emiDueDay);
    const days = daysUntil(dueDate);
    dueItems.push({
      key: `loan-${loan.id}`,
      label: loan.loanName,
      detail: `${loan.lender} EMI`,
      amount: loan.emiAmount ?? 0,
      dueDate,
      days,
      urgency: urgencyFromDays(days),
      href: "/loans",
    });
  }

  for (const fund of funds) {
    if (fund.sipDueDay == null) continue;
    const dueDate = nextOccurrenceForDay(fund.sipDueDay);
    const days = daysUntil(dueDate);
    dueItems.push({
      key: `fund-${fund.id}`,
      label: fund.fundName,
      detail: "Mutual fund SIP",
      amount: fund.sipAmount ?? 0,
      dueDate,
      days,
      urgency: urgencyFromDays(days),
      href: "/mutual-funds",
    });
  }

  for (const debt of debts) {
    if (!debt.dueDate) continue;
    const dueDate = new Date(debt.dueDate);
    const days = daysUntil(dueDate);
    dueItems.push({
      key: `debt-${debt.id}`,
      label: debt.personName,
      detail: debt.direction === "owed_by_me" ? "You owe them" : "They owe you",
      amount: debt.amount,
      dueDate,
      days,
      urgency: urgencyFromDays(days),
      href: "/debts",
    });
  }

  dueItems.sort((a, b) => a.days - b.days);
  const upcoming = dueItems.filter((i) => i.days <= 30);
  const overdueCount = dueItems.filter((i) => i.urgency === "overdue").length;

  const totalBankBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const totalCardDebt = cards.reduce((s, c) => s + c.currentBalance, 0);
  const totalLoanDebt = loans.reduce((s, l) => s + l.outstanding, 0);
  const totalFundValue = funds.reduce((s, f) => s + f.currentValue, 0);
  const debtNet = debts.reduce((s, d) => s + (d.direction === "owed_to_me" ? d.amount : -d.amount), 0);

  const totalAssets = totalBankBalance + totalFundValue;
  const totalLiabilities = totalCardDebt + totalLoanDebt;
  const netWorth = totalAssets + debtNet - totalLiabilities;

  const summaryCards = [
    { label: "Bank Balance", value: totalBankBalance, href: "/accounts", sub: `${accounts.length} account${accounts.length !== 1 ? "s" : ""}` },
    { label: "Card Debt", value: totalCardDebt, href: "/cards", sub: `${cards.length} card${cards.length !== 1 ? "s" : ""}`, negative: true },
    { label: "Loan Outstanding", value: totalLoanDebt, href: "/loans", sub: `${loans.length} loan${loans.length !== 1 ? "s" : ""}`, negative: true },
    { label: "Mutual Funds", value: totalFundValue, href: "/mutual-funds", sub: `${funds.length} fund${funds.length !== 1 ? "s" : ""}` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Welcome back{session?.user?.name ? `, ${session.user.name}` : ""}
        </h1>
        <p className="text-sm text-slate-500">Here&apos;s where things stand today.</p>
      </div>

      {overdueCount > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm font-medium">
          ⚠ You have {overdueCount} overdue payment{overdueCount !== 1 ? "s" : ""}. Check the list below.
        </div>
      )}

      <div className="bg-slate-900 text-white rounded-xl p-6">
        <p className="text-sm text-slate-300">Net worth</p>
        <p className="text-3xl font-semibold mt-1 tabular-nums">{formatMoney(netWorth)}</p>
        <p className="text-xs text-slate-400 mt-2">
          Assets {formatMoney(totalAssets + Math.max(debtNet, 0))} · Liabilities {formatMoney(totalLiabilities + Math.max(-debtNet, 0))}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors"
          >
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className={`text-lg font-semibold mt-1 tabular-nums ${c.negative ? "text-red-600" : "text-slate-900"}`}>
              {formatMoney(c.value)}
            </p>
            <p className="text-xs text-slate-400 mt-1">{c.sub}</p>
          </Link>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Upcoming dues (next 30 days)</h2>
          <span className="text-xs text-slate-400">{upcoming.length} item{upcoming.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="divide-y divide-slate-100">
          {upcoming.length === 0 && (
            <p className="p-6 text-sm text-slate-500 text-center">Nothing due in the next 30 days. Add cards, loans or SIPs to track them here.</p>
          )}
          {upcoming.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50"
            >
              <div>
                <p className="font-medium text-slate-900 text-sm">{item.label}</p>
                <p className="text-xs text-slate-500">{item.detail}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {item.amount > 0 && <span className="text-sm font-medium text-slate-900 tabular-nums">{formatMoney(item.amount)}</span>}
                <span className={`text-xs font-medium border rounded-full px-2.5 py-1 whitespace-nowrap ${urgencyStyles[item.urgency]}`}>
                  {item.urgency === "later"
                    ? item.dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                    : urgencyLabels[item.urgency]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/accounts" className="bg-white border border-slate-200 rounded-xl p-4 text-center hover:border-slate-300">
          <p className="text-sm font-medium text-slate-900">+ Add bank account</p>
        </Link>
        <Link href="/cards" className="bg-white border border-slate-200 rounded-xl p-4 text-center hover:border-slate-300">
          <p className="text-sm font-medium text-slate-900">+ Add credit card</p>
        </Link>
        <Link href="/loans" className="bg-white border border-slate-200 rounded-xl p-4 text-center hover:border-slate-300">
          <p className="text-sm font-medium text-slate-900">+ Add loan</p>
        </Link>
      </div>
    </div>
  );
}

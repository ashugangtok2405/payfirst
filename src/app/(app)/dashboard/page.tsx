import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import {
  nextOccurrenceForDay,
  previousOccurrenceForDay,
  daysUntil,
  urgencyFromDays,
  urgencyStyles,
  urgencyLabels,
  todayInAppTimeZone,
  endOfDayExclusive,
  type Urgency,
} from "@/lib/dueDates";
import { remainingDueOf, statementStatusOf, statementStatusStyles, statementStatusLabels } from "@/lib/creditCardStatements";
import RemindersCard from "../reminders/RemindersCard";
import PayStatementButton from "../cards/PayStatementButton";

type GoalProgress = {
  id: string;
  name: string;
  targetAmount: number;
  saved: number;
};

type DueItem =
  | {
      kind: "urgency";
      key: string;
      label: string;
      detail: string;
      amount: number;
      dueDate: Date;
      days: number;
      urgency: Urgency;
      href: string;
    }
  | {
      kind: "statement";
      key: string;
      label: string;
      detail: string;
      amount: number;
      dueDate: Date;
      days: number;
      statementStatus: "overdue" | "partial" | "unpaid";
      href: string;
      cardId: string;
      cardLabel: string;
      statementOptions: { id: string; label: string; remainingDue: number }[];
    }
  | {
      key: string;
      kind: "unbilled";
      label: string;
      detail: string;
      href: string;
    };

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [accounts, cards, loans, funds, debts, user, payments, goals, statements] = await Promise.all([
    prisma.bankAccount.findMany({ where: { userId } }),
    prisma.creditCard.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId } }),
    prisma.mutualFund.findMany({ where: { userId } }),
    prisma.debt.findMany({ where: { userId, settled: false } }),
    prisma.user.findUnique({ where: { id: userId }, select: { reminderDaysBefore: true } }),
    prisma.transaction.findMany({
      where: { userId, type: "transfer", toAccountType: { in: ["card", "loan"] } },
      select: { toAccountType: true, toAccountId: true, date: true },
    }),
    prisma.goal.findMany({ where: { userId }, include: { contributions: { select: { amount: true } } } }),
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

  const activeGoals: GoalProgress[] = goals
    .map((g) => ({ id: g.id, name: g.name, targetAmount: g.targetAmount, saved: g.contributions.reduce((s, c) => s + c.amount, 0) }))
    .filter((g) => g.saved < g.targetAmount);

  function paidThisCycle(type: "card" | "loan", id: string, dueDay: number) {
    const cycleEnd = endOfDayExclusive(nextOccurrenceForDay(dueDay));
    const cycleStart = previousOccurrenceForDay(dueDay);
    return payments.some((p) => p.toAccountType === type && p.toAccountId === id && p.date > cycleStart && p.date < cycleEnd);
  }

  const todayDate = todayInAppTimeZone();
  const dueItems: DueItem[] = [];

  for (const card of cards) {
    if (card.currentBalance <= 0) continue;

    // A manually-set payment date is authoritative once the user sets one -
    // it always wins over the (optional, advanced) Statement-derived date.
    if (card.nextDueDate) {
      const days = daysUntil(card.nextDueDate);
      dueItems.push({
        kind: "urgency",
        key: `card-${card.id}`,
        label: card.cardName,
        detail: `${card.bankName} credit card payment`,
        amount: card.currentBalance,
        dueDate: card.nextDueDate,
        days,
        urgency: urgencyFromDays(days),
        href: "/cards",
      });
      continue;
    }

    const cardStatements = statementsByCard[card.id] ?? [];
    const latestStatement = cardStatements[0];
    const unpaidLatest = latestStatement ? remainingDueOf(latestStatement) : 0;

    if (unpaidLatest > 0) {
      const status = statementStatusOf(latestStatement, todayDate) as "overdue" | "partial" | "unpaid";
      const days = daysUntil(latestStatement.dueDate);
      const unpaidStatements = cardStatements.filter((s) => remainingDueOf(s) > 0);
      dueItems.push({
        kind: "statement",
        key: `card-${card.id}`,
        label: card.cardName,
        detail: `${card.bankName} credit card payment`,
        amount: unpaidLatest,
        dueDate: latestStatement.dueDate,
        days,
        statementStatus: status,
        href: "/cards",
        cardId: card.id,
        cardLabel: card.cardName,
        statementOptions: unpaidStatements.map((s) => ({
          id: s.id,
          label: s.periodEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
          remainingDue: remainingDueOf(s),
        })),
      });
    } else {
      dueItems.push({
        kind: "unbilled",
        key: `card-${card.id}`,
        label: card.cardName,
        detail: `${card.bankName} · ${formatMoney(card.currentBalance)} - set a payment date`,
        href: "/cards",
      });
    }
  }

  for (const loan of loans) {
    if (paidThisCycle("loan", loan.id, loan.emiDueDay)) continue;
    const dueDate = nextOccurrenceForDay(loan.emiDueDay);
    const days = daysUntil(dueDate);
    dueItems.push({
      kind: "urgency",
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
      kind: "urgency",
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
      kind: "urgency",
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

  dueItems.sort((a, b) => (a.kind === "unbilled" ? Infinity : a.days) - (b.kind === "unbilled" ? Infinity : b.days));
  const upcoming = dueItems.filter((i) => i.kind === "unbilled" || i.days <= 30);
  const overdueCount = dueItems.filter((i) => (i.kind === "urgency" && i.urgency === "overdue") || (i.kind === "statement" && i.statementStatus === "overdue")).length;

  const totalBankBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const totalCardDebt = cards.reduce((s, c) => s + c.currentBalance, 0);
  const totalLoanDebt = loans.reduce((s, l) => s + l.outstanding, 0);
  const totalFundValue = funds.reduce((s, f) => s + f.currentValue, 0);
  const debtNet = debts.reduce((s, d) => s + (d.direction === "owed_to_me" ? d.amount : -d.amount), 0);

  const totalAssets = totalBankBalance + totalFundValue;
  const totalLiabilities = totalCardDebt + totalLoanDebt;
  const netWorth = totalAssets + debtNet - totalLiabilities;

  const initials = (session?.user?.name ?? session?.user?.email ?? "?")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

  const summaryCards = [
    { label: "Bank Balance", value: totalBankBalance, href: "/accounts", sub: `${accounts.length} account${accounts.length !== 1 ? "s" : ""}`, tint: "mint" as const },
    { label: "Card Debt", value: totalCardDebt, href: "/cards", sub: `${cards.length} card${cards.length !== 1 ? "s" : ""}`, tint: "coral" as const },
    { label: "Loan Outstanding", value: totalLoanDebt, href: "/loans", sub: `${loans.length} loan${loans.length !== 1 ? "s" : ""}`, tint: "coral" as const },
    { label: "Mutual Funds", value: totalFundValue, href: "/mutual-funds", sub: `${funds.length} fund${funds.length !== 1 ? "s" : ""}`, tint: "teal" as const },
  ];
  const tintClasses = {
    mint: "bg-mint-soft text-mint",
    coral: "bg-coral-soft text-coral",
    teal: "bg-teal-soft text-teal",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display font-semibold text-ink">
            Hi{session?.user?.name ? `, ${session.user.name.split(" ")[0]}` : ""}
          </p>
          <p className="text-xs text-muted mt-0.5">{today}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center font-display font-semibold text-sm">
          {initials}
        </div>
      </div>

      {overdueCount > 0 && (
        <div className="bg-coral-soft text-coral rounded-2xl px-4 py-3 text-sm font-medium">
          You have {overdueCount} overdue payment{overdueCount !== 1 ? "s" : ""}. Check the list below.
        </div>
      )}

      <div className="bg-accent text-white rounded-[22px] p-5 shadow-card">
        <p className="text-sm text-white/70">Net worth</p>
        <p className="font-display text-3xl font-semibold mt-1 tabular-nums">{formatMoney(netWorth)}</p>
        <p className="text-xs text-white/70 mt-2 tabular-nums">
          Assets {formatMoney(totalAssets + Math.max(debtNet, 0))} · Liabilities {formatMoney(totalLiabilities + Math.max(-debtNet, 0))}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Link href="/transactions?add=expense" className="flex flex-col items-center gap-1.5">
          <span className="w-[52px] h-[52px] rounded-2xl bg-coral-soft text-coral flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[22px] h-[22px]">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </span>
          <span className="text-[11px] font-medium text-ink">Expense</span>
        </Link>
        <Link href="/transactions?add=income" className="flex flex-col items-center gap-1.5">
          <span className="w-[52px] h-[52px] rounded-2xl bg-mint-soft text-mint flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[22px] h-[22px]">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </span>
          <span className="text-[11px] font-medium text-ink">Income</span>
        </Link>
        <Link href="/transactions?add=transfer" className="flex flex-col items-center gap-1.5">
          <span className="w-[52px] h-[52px] rounded-2xl bg-accent-soft text-accent flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[22px] h-[22px]">
              <path d="M7 7h13l-3-3M17 17H4l3 3" />
            </svg>
          </span>
          <span className="text-[11px] font-medium text-ink">Transfer</span>
        </Link>
      </div>

      <div
        className="flex md:grid md:grid-cols-4 gap-2.5 md:gap-3 overflow-x-auto md:overflow-visible scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 pb-1"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {summaryCards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="shrink-0 w-[132px] md:w-auto bg-white rounded-2xl shadow-card p-3"
            style={{ scrollSnapAlign: "start" }}
          >
            <p className="text-[11px] text-muted truncate">{c.label}</p>
            <p className={`inline-block mt-2 text-sm font-display font-semibold tabular-nums px-2 py-1 rounded-lg ${tintClasses[c.tint]}`}>
              {formatMoney(c.value)}
            </p>
            <p className="text-[10.5px] text-muted mt-1.5">{c.sub}</p>
          </Link>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-3 lg:gap-5 lg:items-start space-y-5 lg:space-y-0">
        <div className="lg:col-span-1 lg:order-2 space-y-5">
          {activeGoals.length > 0 && (
            <div className="bg-white rounded-2xl shadow-card p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-ink">Goals</h2>
                <Link href="/goals" className="text-xs text-muted hover:text-ink">
                  View all
                </Link>
              </div>
              <div className="space-y-3">
                {activeGoals.map((goal) => {
                  const pct = goal.targetAmount > 0 ? Math.round((goal.saved / goal.targetAmount) * 100) : 0;
                  return (
                    <Link key={goal.id} href="/goals" className="block group">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-ink group-hover:underline">{goal.name}</span>
                        <span className="text-muted tabular-nums">
                          {formatMoney(goal.saved)} of {formatMoney(goal.targetAmount)} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-accent-soft overflow-hidden">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <RemindersCard reminderDaysBefore={user?.reminderDaysBefore ?? 3} />
        </div>

      <div className="lg:col-span-2 lg:order-1 bg-white rounded-2xl shadow-card">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-ink">Upcoming dues (next 30 days)</h2>
          <span className="text-xs text-muted">{upcoming.length} item{upcoming.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="divide-y divide-border">
          {upcoming.length === 0 && (
            <p className="p-6 text-sm text-muted text-center">Nothing due in the next 30 days. Add cards, loans or SIPs to track them here.</p>
          )}
          {upcoming.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4 px-5 py-3">
              <Link href={item.href} className="min-w-0 hover:opacity-70">
                <p className="font-medium text-ink text-sm truncate">{item.label}</p>
                <p className="text-xs text-muted truncate">{item.detail}</p>
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                {item.kind === "urgency" && (
                  <>
                    <span className="text-sm font-medium text-ink tabular-nums">{item.amount > 0 ? formatMoney(item.amount) : ""}</span>
                    <span className={`text-xs font-medium border rounded-full px-2.5 py-1 whitespace-nowrap ${urgencyStyles[item.urgency]}`}>
                      {item.urgency === "later"
                        ? item.dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                        : urgencyLabels[item.urgency]}
                    </span>
                  </>
                )}
                {item.kind === "statement" && (
                  <>
                    <span className="text-sm font-medium text-ink tabular-nums">{formatMoney(item.amount)}</span>
                    <span className={`text-xs font-medium border rounded-full px-2.5 py-1 whitespace-nowrap ${statementStatusStyles[item.statementStatus]}`}>
                      {statementStatusLabels[item.statementStatus]}
                    </span>
                    <PayStatementButton
                      cardId={item.cardId}
                      cardLabel={item.cardLabel}
                      statementOptions={item.statementOptions}
                      bankAccounts={accounts}
                      cards={cards}
                    />
                  </>
                )}
                {item.kind === "unbilled" && (
                  <Link href="/cards" className="text-xs font-medium text-accent whitespace-nowrap">
                    Set payment date →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/accounts" className="bg-white rounded-2xl shadow-card p-4 text-center hover:border-accent">
          <p className="text-sm font-medium text-ink">+ Add bank account</p>
        </Link>
        <Link href="/cards" className="bg-white rounded-2xl shadow-card p-4 text-center hover:border-accent">
          <p className="text-sm font-medium text-ink">+ Add credit card</p>
        </Link>
        <Link href="/loans" className="bg-white rounded-2xl shadow-card p-4 text-center hover:border-accent">
          <p className="text-sm font-medium text-ink">+ Add loan</p>
        </Link>
      </div>
    </div>
  );
}

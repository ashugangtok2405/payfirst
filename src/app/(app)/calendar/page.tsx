import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { todayInAppTimeZone, parseMonthParam, monthParamFor, dateForDayInMonth } from "@/lib/dueDates";
import { ghostButtonClass } from "@/components/form";

type ItemType = "card" | "loan" | "fund" | "debt";

type CalendarItem = {
  day: number;
  type: ItemType;
  label: string;
  detail: string;
  amount: number;
  href: string;
};

const TYPE_STYLES: Record<ItemType, { dot: string; badge: string; label: string }> = {
  card: { dot: "bg-accent", badge: "bg-accent-soft text-accent border-accent/30", label: "Credit Card" },
  loan: { dot: "bg-purple", badge: "bg-purple-soft text-purple border-purple/30", label: "Loan EMI" },
  fund: { dot: "bg-teal", badge: "bg-teal-soft text-teal border-teal/30", label: "Mutual Fund SIP" },
  debt: { dot: "bg-amber", badge: "bg-amber-soft text-amber border-amber/30", label: "Debt" },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;

  const { month: monthParam } = await searchParams;
  const today = todayInAppTimeZone();
  const { year, month } = parseMonthParam(monthParam, today);
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);

  const [cards, loans, funds, debts] = await Promise.all([
    prisma.creditCard.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId } }),
    prisma.mutualFund.findMany({ where: { userId } }),
    prisma.debt.findMany({ where: { userId, settled: false } }),
  ]);

  const items: CalendarItem[] = [];

  for (const card of cards) {
    const date = dateForDayInMonth(card.dueDay, year, month);
    items.push({
      day: date.getDate(),
      type: "card",
      label: card.cardName,
      detail: `${card.bankName} credit card payment`,
      amount: card.minPayment ?? card.currentBalance,
      href: "/cards",
    });
  }

  for (const loan of loans) {
    const date = dateForDayInMonth(loan.emiDueDay, year, month);
    items.push({
      day: date.getDate(),
      type: "loan",
      label: loan.loanName,
      detail: `${loan.lender} EMI`,
      amount: loan.emiAmount ?? 0,
      href: "/loans",
    });
  }

  for (const fund of funds) {
    if (fund.sipDueDay == null) continue;
    const date = dateForDayInMonth(fund.sipDueDay, year, month);
    items.push({
      day: date.getDate(),
      type: "fund",
      label: fund.fundName,
      detail: "Mutual fund SIP",
      amount: fund.sipAmount ?? 0,
      href: "/mutual-funds",
    });
  }

  for (const debt of debts) {
    if (!debt.dueDate) continue;
    const dueDate = new Date(debt.dueDate);
    if (dueDate < monthStart || dueDate >= monthEnd) continue;
    items.push({
      day: dueDate.getDate(),
      type: "debt",
      label: debt.personName,
      detail: debt.direction === "owed_by_me" ? "You owe them" : "They owe you",
      amount: debt.amount,
      href: "/debts",
    });
  }

  const itemsByDay = new Map<number, CalendarItem[]>();
  for (const item of items) {
    const list = itemsByDay.get(item.day) ?? [];
    list.push(item);
    itemsByDay.set(item.day, list);
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = monthStart.getDay();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const sortedItems = [...items].sort((a, b) => a.day - b.day);
  const monthLabel = monthStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const prevHref = `/calendar?month=${monthParamFor(year, month - 1)}`;
  const nextHref = `/calendar?month=${monthParamFor(year, month + 1)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-ink">Bill Calendar</h1>
          <p className="text-sm text-muted">{items.length} due date{items.length !== 1 ? "s" : ""} this month</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={prevHref} className={ghostButtonClass} aria-label="Previous month">
            ← Prev
          </Link>
          <span className="text-sm font-medium text-ink min-w-[9rem] text-center">{monthLabel}</span>
          <Link href={nextHref} className={ghostButtonClass} aria-label="Next month">
            Next →
          </Link>
          {!isCurrentMonth && (
            <Link href="/calendar" className={ghostButtonClass}>
              Today
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted">
        {(Object.keys(TYPE_STYLES) as ItemType[]).map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${TYPE_STYLES[t].dot}`} />
            {TYPE_STYLES[t].label}
          </span>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((w) => (
            <div key={w} className="p-2 text-center text-xs font-medium text-muted">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-accent-soft">
          {cells.map((day, idx) => {
            const dayItems = day ? itemsByDay.get(day) ?? [] : [];
            const isToday = isCurrentMonth && day === today.getDate();

            return (
              <div key={idx} className={`bg-white min-h-[4.5rem] p-1.5 sm:p-2 ${day == null ? "bg-bg" : ""}`}>
                {day != null && (
                  <>
                    <span
                      className={`inline-flex items-center justify-center text-xs font-medium rounded-full w-5 h-5 ${
                        isToday ? "bg-accent text-white" : "text-ink"
                      }`}
                    >
                      {day}
                    </span>
                    {dayItems.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {dayItems.slice(0, 4).map((item, i) => (
                          <span
                            key={i}
                            title={`${item.label} · ${formatMoney(item.amount)}`}
                            className={`w-1.5 h-1.5 rounded-full ${TYPE_STYLES[item.type].dot}`}
                          />
                        ))}
                        {dayItems.length > 4 && <span className="text-[10px] text-muted">+{dayItems.length - 4}</span>}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card divide-y divide-border">
        {sortedItems.length === 0 && (
          <p className="p-6 text-sm text-muted text-center">Nothing due this month.</p>
        )}
        {sortedItems.map((item, i) => (
          <Link key={i} href={item.href} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-bg">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-ink tabular-nums w-6">{item.day}</span>
              <div>
                <p className="text-sm font-medium text-ink">{item.label}</p>
                <p className="text-xs text-muted">{item.detail}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {item.amount > 0 && <span className="text-sm font-medium text-ink tabular-nums">{formatMoney(item.amount)}</span>}
              <span className={`text-xs font-medium border rounded-full px-2.5 py-1 ${TYPE_STYLES[item.type].badge}`}>
                {TYPE_STYLES[item.type].label}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

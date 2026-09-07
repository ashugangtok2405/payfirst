// Recurring monthly due dates (credit card / EMI / SIP) are stored as a day-of-month
// integer. These helpers turn that into a concrete next-occurrence date and an
// urgency bucket so the dashboard can highlight what needs attention first.

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function nextOccurrenceForDay(day: number, today: Date = new Date()): Date {
  const clampedDay = Math.min(Math.max(day, 1), 31);
  const y = today.getFullYear();
  const m = today.getMonth();

  const thisMonthDay = Math.min(clampedDay, daysInMonth(y, m));
  const thisMonth = new Date(y, m, thisMonthDay);
  thisMonth.setHours(0, 0, 0, 0);

  const todayStart = new Date(y, m, today.getDate());
  todayStart.setHours(0, 0, 0, 0);

  if (thisMonth.getTime() >= todayStart.getTime()) {
    return thisMonth;
  }

  const nextMonthDay = Math.min(clampedDay, daysInMonth(y, m + 1));
  return new Date(y, m + 1, nextMonthDay);
}

export function daysUntil(date: Date, today: Date = new Date()): number {
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffMs = target.getTime() - todayStart.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export type Urgency = "overdue" | "today" | "soon" | "later";

export function urgencyFromDays(days: number): Urgency {
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "soon";
  return "later";
}

export const urgencyStyles: Record<Urgency, string> = {
  overdue: "bg-red-100 text-red-800 border-red-300",
  today: "bg-orange-100 text-orange-800 border-orange-300",
  soon: "bg-amber-100 text-amber-800 border-amber-300",
  later: "bg-slate-100 text-slate-700 border-slate-300",
};

export const urgencyLabels: Record<Urgency, string> = {
  overdue: "Overdue",
  today: "Due today",
  soon: "Due soon",
  later: "Upcoming",
};

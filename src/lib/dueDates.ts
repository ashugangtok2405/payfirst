// Recurring monthly due dates (credit card / EMI / SIP) are stored as a day-of-month
// integer. These helpers turn that into a concrete next-occurrence date and an
// urgency bucket so the dashboard can highlight what needs attention first.

// All "what day is it" calculations are anchored to this timezone rather than the
// server's own clock - deployed hosts (e.g. Netlify) run in UTC, which would
// otherwise make "today" lag a calendar day behind India for part of each day.
const APP_TIMEZONE = "Asia/Kolkata";

export function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

// Places a stored day-of-month (card due day, EMI day, SIP day) onto a specific
// calendar month being viewed, clamped to that month's length - independent of
// "today," unlike nextOccurrenceForDay which always looks forward from now.
export function dateForDayInMonth(day: number, year: number, month: number): Date {
  const clampedDay = Math.min(Math.max(day, 1), 31);
  return new Date(year, month, Math.min(clampedDay, daysInMonth(year, month)));
}

export function parseMonthParam(monthParam: string | undefined, today: Date): { year: number; month: number } {
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [year, month] = monthParam.split("-").map(Number);
    return { year, month: month - 1 };
  }
  return { year: today.getFullYear(), month: today.getMonth() };
}

export function monthParamFor(year: number, month: number): string {
  const normalized = new Date(year, month, 1);
  return `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, "0")}`;
}

export function todayInAppTimeZone(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return new Date(get("year"), get("month") - 1, get("day"));
}

// Formats a calendar-day Date (constructed via `new Date(y, m, d)`) as YYYY-MM-DD
// using its local components - NOT toISOString(), which would convert through UTC
// and can shift the date by a day depending on the server's timezone.
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function nextOccurrenceForDay(day: number, today: Date = todayInAppTimeZone()): Date {
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

// The occurrence immediately before nextOccurrenceForDay's result - used to
// bound "this billing cycle" as (previous due date, next due date].
export function previousOccurrenceForDay(day: number, today: Date = todayInAppTimeZone()): Date {
  const next = nextOccurrenceForDay(day, today);
  const y = next.getFullYear();
  const m = next.getMonth() - 1;
  const clampedDay = Math.min(Math.max(day, 1), 31);
  return new Date(y, m, Math.min(clampedDay, daysInMonth(y, m)));
}

// nextOccurrenceForDay/previousOccurrenceForDay return midnight of the due
// date, so a transaction dated any time later that same day (which is the
// common case - transactions now carry a real time of day, not just a date)
// would otherwise fail a plain `date <= cycleEnd` check. Use this as the
// upper bound instead, to mean "through the end of that calendar day".
export function endOfDayExclusive(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

export function daysUntil(date: Date, today: Date = todayInAppTimeZone()): number {
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
  overdue: "bg-coral-soft text-coral border-coral/30",
  today: "bg-amber-soft text-amber border-amber/30",
  soon: "bg-amber-soft text-amber border-amber/30",
  later: "bg-bg text-muted border-border",
};

export const urgencyLabels: Record<Urgency, string> = {
  overdue: "Overdue",
  today: "Due today",
  soon: "Due soon",
  later: "Upcoming",
};

import type { Config } from "@netlify/functions";
import { PrismaClient } from "@prisma/client";
import webpush from "web-push";

const prisma = new PrismaClient();

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// This function runs on Netlify's infrastructure, which uses UTC - not the app's
// India-based due dates. Anchor "today" to IST explicitly so a run at, say,
// 1am IST (7:30pm UTC the previous day) doesn't compute one day behind.
const APP_TIMEZONE = "Asia/Kolkata";

function todayInAppTimeZone(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return new Date(get("year"), get("month") - 1, get("day"));
}

// YYYY-MM-DD from a calendar-day Date's local components - NOT toISOString(),
// which converts through UTC and can shift the date by a day.
function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function nextOccurrenceForDay(day: number, today: Date): Date {
  const clampedDay = Math.min(Math.max(day, 1), 31);
  const y = today.getFullYear();
  const m = today.getMonth();

  const thisMonthDay = Math.min(clampedDay, daysInMonth(y, m));
  const thisMonth = new Date(y, m, thisMonthDay);
  thisMonth.setHours(0, 0, 0, 0);

  const todayStart = new Date(y, m, today.getDate());
  todayStart.setHours(0, 0, 0, 0);

  if (thisMonth.getTime() >= todayStart.getTime()) return thisMonth;

  const nextMonthDay = Math.min(clampedDay, daysInMonth(y, m + 1));
  return new Date(y, m + 1, nextMonthDay);
}

function daysUntil(date: Date, today: Date): number {
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((target.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
}

type DueItem = { key: string; label: string; detail: string; dueDate: Date; days: number };

export default async (req: Request) => {
  const today = todayInAppTimeZone();

  const users = await prisma.user.findMany({
    include: {
      creditCards: true,
      loans: true,
      mutualFunds: true,
      debts: { where: { settled: false } },
      pushSubscriptions: true,
    },
  });

  let sentCount = 0;

  for (const user of users) {
    if (user.pushSubscriptions.length === 0) continue;

    const items: DueItem[] = [];

    for (const card of user.creditCards) {
      const dueDate = nextOccurrenceForDay(card.dueDay, today);
      items.push({
        key: `card:${card.id}:${formatDateKey(dueDate)}`,
        label: card.cardName,
        detail: `${card.bankName} credit card payment`,
        dueDate,
        days: daysUntil(dueDate, today),
      });
    }

    for (const loan of user.loans) {
      const dueDate = nextOccurrenceForDay(loan.emiDueDay, today);
      items.push({
        key: `loan:${loan.id}:${formatDateKey(dueDate)}`,
        label: loan.loanName,
        detail: `${loan.lender} EMI`,
        dueDate,
        days: daysUntil(dueDate, today),
      });
    }

    for (const fund of user.mutualFunds) {
      if (fund.sipDueDay == null) continue;
      const dueDate = nextOccurrenceForDay(fund.sipDueDay, today);
      items.push({
        key: `fund:${fund.id}:${formatDateKey(dueDate)}`,
        label: fund.fundName,
        detail: "Mutual fund SIP",
        dueDate,
        days: daysUntil(dueDate, today),
      });
    }

    for (const debt of user.debts) {
      if (!debt.dueDate) continue;
      const dueDate = new Date(debt.dueDate);
      items.push({
        key: `debt:${debt.id}:${formatDateKey(dueDate)}`,
        label: debt.personName,
        detail: debt.direction === "owed_by_me" ? "Payment due to them" : "Payment due from them",
        dueDate,
        days: daysUntil(dueDate, today),
      });
    }

    const toNotify = items.filter((i) => i.days === user.reminderDaysBefore || i.days === 0);

    for (const item of toNotify) {
      const already = await prisma.sentReminder.findUnique({
        where: { userId_key: { userId: user.id, key: item.key } },
      });
      if (already) continue;

      const payload = JSON.stringify({
        title:
          item.days === 0
            ? `Due today: ${item.label}`
            : `Due in ${item.days} day${item.days === 1 ? "" : "s"}: ${item.label}`,
        body: `${item.detail} on ${item.dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
        url: "/dashboard",
      });

      for (const sub of user.pushSubscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          sentCount++;
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          }
        }
      }

      await prisma.sentReminder.create({ data: { userId: user.id, key: item.key } });
    }
  }

  return new Response(JSON.stringify({ ok: true, sentCount }), {
    headers: { "content-type": "application/json" },
  });
};

export const config: Config = {
  schedule: "30 2 * * *",
};

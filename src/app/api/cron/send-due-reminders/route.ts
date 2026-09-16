import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { todayInAppTimeZone, nextOccurrenceForDay, daysUntil, formatDateKey } from "@/lib/dueDates";
import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

type DueItem = { key: string; label: string; detail: string; dueDate: Date; days: number };

// Runs daily via Vercel Cron (see vercel.json). Vercel automatically sends
// `Authorization: Bearer <CRON_SECRET>` for cron-triggered requests when the
// CRON_SECRET env var is set, so this checks that to reject other callers.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

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

  return NextResponse.json({ ok: true, sentCount });
}

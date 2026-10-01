import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { todayInAppTimeZone, nextOccurrenceForDay, previousOccurrenceForDay, formatDateKey, endOfDayExclusive } from "@/lib/dueDates";
import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// Runs daily via Vercel Cron (see vercel.json), a little after the due-date
// reminder cron. For every loan with an auto-debit account set whose EMI is
// due today: if the account has enough balance, logs the EMI payment as a
// real transfer (same balance effects as a manual payment); if not, sends a
// push notification asking the user to top up, instead of silently failing.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const today = todayInAppTimeZone();
  const todayDay = today.getDate();

  const loans = await prisma.loan.findMany({
    where: { autoDebitAccountId: { not: null }, emiDueDay: todayDay },
    include: { user: { include: { pushSubscriptions: true } } },
  });

  let debited = 0;
  let notified = 0;
  let skipped = 0;

  for (const loan of loans) {
    if (!loan.emiAmount || loan.emiAmount <= 0 || !loan.autoDebitAccountId) {
      skipped++;
      continue;
    }

    const cycleEnd = endOfDayExclusive(nextOccurrenceForDay(loan.emiDueDay, today));
    const cycleStart = previousOccurrenceForDay(loan.emiDueDay, today);
    const alreadyPaid = await prisma.transaction.findFirst({
      where: {
        userId: loan.userId,
        toAccountType: "loan",
        toAccountId: loan.id,
        date: { gt: cycleStart, lt: cycleEnd },
      },
    });
    if (alreadyPaid) {
      skipped++;
      continue;
    }

    const account = await prisma.bankAccount.findUnique({ where: { id: loan.autoDebitAccountId } });
    if (!account) {
      skipped++;
      continue;
    }

    if (account.balance >= loan.emiAmount) {
      await prisma.$transaction([
        prisma.transaction.create({
          data: {
            userId: loan.userId,
            type: "transfer",
            amount: loan.emiAmount,
            date: new Date(),
            category: "EMI Auto-debit",
            note: "Automatic EMI debit",
            fromAccountType: "bank",
            fromAccountId: account.id,
            toAccountType: "loan",
            toAccountId: loan.id,
          },
        }),
        prisma.bankAccount.update({ where: { id: account.id }, data: { balance: { decrement: loan.emiAmount } } }),
        prisma.loan.update({ where: { id: loan.id }, data: { outstanding: { decrement: loan.emiAmount } } }),
      ]);
      debited++;
    } else {
      const key = `autodebit-insufficient:${loan.id}:${formatDateKey(today)}`;
      const already = await prisma.sentReminder.findUnique({
        where: { userId_key: { userId: loan.userId, key } },
      });
      if (!already && loan.user.pushSubscriptions.length > 0) {
        const payload = JSON.stringify({
          title: `Auto-debit failed: ${loan.loanName}`,
          body: `${account.accountName} (${account.bankName}) only has ₹${account.balance.toLocaleString("en-IN")} — EMI of ₹${loan.emiAmount.toLocaleString("en-IN")} needs topping up.`,
          url: "/loans",
        });
        for (const sub of loan.user.pushSubscriptions) {
          try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
            notified++;
          } catch (err) {
            const statusCode = (err as { statusCode?: number }).statusCode;
            if (statusCode === 404 || statusCode === 410) {
              await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
            }
          }
        }
        await prisma.sentReminder.create({ data: { userId: loan.userId, key } });
      }
    }
  }

  return NextResponse.json({ ok: true, debited, notified, skipped });
}

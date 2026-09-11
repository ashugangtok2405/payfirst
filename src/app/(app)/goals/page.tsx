import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import GoalsManager from "./GoalsManager";

export default async function GoalsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [goals, bankAccounts] = await Promise.all([
    prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: { bankAccount: true, contributions: { select: { amount: true } } },
    }),
    prisma.bankAccount.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);

  const rows = goals.map((g) => ({
    id: g.id,
    name: g.name,
    targetAmount: g.targetAmount,
    targetDate: g.targetDate,
    bankAccountId: g.bankAccountId,
    bankAccountLabel: `${g.bankAccount.accountName} (${g.bankAccount.bankName})`,
    notes: g.notes,
    saved: g.contributions.reduce((sum, c) => sum + c.amount, 0),
  }));

  return <GoalsManager goals={rows} bankAccounts={bankAccounts} />;
}

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LoansManager from "./LoansManager";

export default async function LoansPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [loans, bankAccounts, cards] = await Promise.all([
    prisma.loan.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.bankAccount.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.creditCard.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);

  return <LoansManager loans={loans} bankAccounts={bankAccounts} cards={cards} />;
}

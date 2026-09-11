import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CardsManager from "./CardsManager";

export default async function CardsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [cards, bankAccounts] = await Promise.all([
    prisma.creditCard.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.bankAccount.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);

  return <CardsManager cards={cards} bankAccounts={bankAccounts} />;
}

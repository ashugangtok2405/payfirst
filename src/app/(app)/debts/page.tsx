import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DebtsManager from "./DebtsManager";

export default async function DebtsPage() {
  const session = await auth();
  const debts = await prisma.debt.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "asc" },
  });

  return <DebtsManager debts={debts} />;
}

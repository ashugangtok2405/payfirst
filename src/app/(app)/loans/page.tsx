import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LoansManager from "./LoansManager";

export default async function LoansPage() {
  const session = await auth();
  const loans = await prisma.loan.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "asc" },
  });

  return <LoansManager loans={loans} />;
}

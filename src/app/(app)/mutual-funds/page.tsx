import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import FundsManager from "./FundsManager";

export default async function MutualFundsPage() {
  const session = await auth();
  const funds = await prisma.mutualFund.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "asc" },
  });

  return <FundsManager funds={funds} />;
}

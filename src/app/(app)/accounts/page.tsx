import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AccountsManager from "./AccountsManager";

export default async function AccountsPage() {
  const session = await auth();
  const accounts = await prisma.bankAccount.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "asc" },
  });

  return <AccountsManager accounts={accounts} />;
}

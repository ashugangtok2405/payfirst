import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CardsManager from "./CardsManager";

export default async function CardsPage() {
  const session = await auth();
  const cards = await prisma.creditCard.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "asc" },
  });

  return <CardsManager cards={cards} />;
}

-- AlterTable
ALTER TABLE "CreditCard" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "cardTxnType" TEXT,
ADD COLUMN     "postedDate" TIMESTAMP(3),
ADD COLUMN     "statementId" TEXT;

-- CreateTable
CREATE TABLE "CreditCardStatement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "openingBalance" DOUBLE PRECISION NOT NULL,
    "purchaseTotal" DOUBLE PRECISION NOT NULL,
    "refundTotal" DOUBLE PRECISION NOT NULL,
    "feeTotal" DOUBLE PRECISION NOT NULL,
    "interestTotal" DOUBLE PRECISION NOT NULL,
    "statementTotal" DOUBLE PRECISION NOT NULL,
    "minimumDue" DOUBLE PRECISION NOT NULL,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "CreditCardStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditCardPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "statementId" TEXT,
    "transactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditCardPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditCardStatement_cardId_periodEnd_key" ON "CreditCardStatement"("cardId", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "CreditCardPayment_transactionId_key" ON "CreditCardPayment"("transactionId");

-- AddForeignKey
ALTER TABLE "CreditCardStatement" ADD CONSTRAINT "CreditCardStatement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardStatement" ADD CONSTRAINT "CreditCardStatement_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardPayment" ADD CONSTRAINT "CreditCardPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardPayment" ADD CONSTRAINT "CreditCardPayment_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardPayment" ADD CONSTRAINT "CreditCardPayment_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "CreditCardStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardPayment" ADD CONSTRAINT "CreditCardPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "CreditCardStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

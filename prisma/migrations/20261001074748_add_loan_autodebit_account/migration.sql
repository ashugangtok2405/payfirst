-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "autoDebitAccountId" TEXT;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_autoDebitAccountId_fkey" FOREIGN KEY ("autoDebitAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

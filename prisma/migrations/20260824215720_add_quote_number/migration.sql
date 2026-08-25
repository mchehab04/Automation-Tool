-- AlterTable
ALTER TABLE "Quote" ADD COLUMN "number" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Quote_number_key" ON "Quote"("number");

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "previousLeadId" TEXT;

-- CreateIndex
CREATE INDEX "Lead_previousLeadId_idx" ON "Lead"("previousLeadId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_previousLeadId_fkey" FOREIGN KEY ("previousLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

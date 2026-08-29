-- AlterEnum
ALTER TYPE "PipelineStage" ADD VALUE 'IN_PROGRESS';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "vehicleMake" TEXT,
ADD COLUMN     "vehicleModel" TEXT,
ADD COLUMN     "vehicleYear" TEXT;


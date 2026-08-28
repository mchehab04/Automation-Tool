-- CreateEnum
CREATE TYPE "BusinessCategory" AS ENUM ('AUTO_GARAGE', 'HOUSE_MAINTENANCE', 'REAL_ESTATE');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN "category" "BusinessCategory" NOT NULL DEFAULT 'AUTO_GARAGE';

-- AlterTable
ALTER TABLE "ServiceCatalogItem" ADD COLUMN "category" "BusinessCategory" NOT NULL DEFAULT 'AUTO_GARAGE';

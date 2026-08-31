-- CreateEnum
CREATE TYPE "EmployeeRole" AS ENUM ('OWNER', 'STAFF');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "role" "EmployeeRole" NOT NULL DEFAULT 'STAFF';

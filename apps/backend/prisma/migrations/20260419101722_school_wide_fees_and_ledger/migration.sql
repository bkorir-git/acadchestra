-- CreateEnum
CREATE TYPE "public"."FeeStructureScope" AS ENUM ('SCHOOL_WIDE', 'CLASS_SPECIFIC', 'GRADE_SPECIFIC');

-- CreateEnum
CREATE TYPE "public"."LedgerEntryType" AS ENUM ('DEBIT', 'CREDIT', 'REVERSAL', 'ADJUSTMENT', 'WAIVER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'FEE_STRUCTURE_LEVEL';
ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'FEE_LEDGER';
ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'TERM_ACTIVATION_BILLING';

-- DropForeignKey
ALTER TABLE "public"."student_fee_components" DROP CONSTRAINT "student_fee_components_feeComponentId_fkey";

-- AlterTable
ALTER TABLE "public"."fee_structures" ADD COLUMN     "isAutoBill" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scope" "public"."FeeStructureScope" NOT NULL DEFAULT 'CLASS_SPECIFIC';

-- AlterTable
ALTER TABLE "public"."student_fee_components" ADD COLUMN     "feeLevelComponentId" TEXT,
ALTER COLUMN "feeComponentId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."fee_structure_levels" (
    "id" TEXT NOT NULL,
    "levelLabel" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feeStructureId" TEXT NOT NULL,
    "classId" TEXT,
    "gradeLevel" INTEGER,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_structure_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fee_level_components" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "isCompulsory" BOOLEAN NOT NULL DEFAULT true,
    "category" "public"."FeeCategory" NOT NULL DEFAULT 'ACADEMIC',
    "dueDate" TIMESTAMP(3),
    "lateFee" DOUBLE PRECISION DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "feeStructureLevelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_level_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fee_ledger" (
    "id" TEXT NOT NULL,
    "entryType" "public"."LedgerEntryType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "metadata" JSONB,
    "recordedById" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studentId" TEXT NOT NULL,
    "studentFeeId" TEXT,
    "feePaymentId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fee_structure_levels_feeStructureId_gradeLevel_idx" ON "public"."fee_structure_levels"("feeStructureId", "gradeLevel");

-- CreateIndex
CREATE INDEX "fee_structure_levels_tenantId_idx" ON "public"."fee_structure_levels"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "fee_structure_levels_feeStructureId_classId_key" ON "public"."fee_structure_levels"("feeStructureId", "classId");

-- CreateIndex
CREATE INDEX "fee_level_components_feeStructureLevelId_sortOrder_idx" ON "public"."fee_level_components"("feeStructureLevelId", "sortOrder");

-- CreateIndex
CREATE INDEX "fee_ledger_tenantId_studentId_occurredAt_idx" ON "public"."fee_ledger"("tenantId", "studentId", "occurredAt");

-- CreateIndex
CREATE INDEX "fee_ledger_tenantId_occurredAt_idx" ON "public"."fee_ledger"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "fee_ledger_tenantId_entryType_idx" ON "public"."fee_ledger"("tenantId", "entryType");

-- CreateIndex
CREATE INDEX "fee_structures_tenantId_scope_isAutoBill_idx" ON "public"."fee_structures"("tenantId", "scope", "isAutoBill");

-- AddForeignKey
ALTER TABLE "public"."fee_structure_levels" ADD CONSTRAINT "fee_structure_levels_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "public"."fee_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structure_levels" ADD CONSTRAINT "fee_structure_levels_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structure_levels" ADD CONSTRAINT "fee_structure_levels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_level_components" ADD CONSTRAINT "fee_level_components_feeStructureLevelId_fkey" FOREIGN KEY ("feeStructureLevelId") REFERENCES "public"."fee_structure_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_ledger" ADD CONSTRAINT "fee_ledger_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_ledger" ADD CONSTRAINT "fee_ledger_studentFeeId_fkey" FOREIGN KEY ("studentFeeId") REFERENCES "public"."student_fees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_ledger" ADD CONSTRAINT "fee_ledger_feePaymentId_fkey" FOREIGN KEY ("feePaymentId") REFERENCES "public"."fee_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_ledger" ADD CONSTRAINT "fee_ledger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_fee_components" ADD CONSTRAINT "student_fee_components_feeComponentId_fkey" FOREIGN KEY ("feeComponentId") REFERENCES "public"."fee_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

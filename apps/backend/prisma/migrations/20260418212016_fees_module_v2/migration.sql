/*
  Warnings:

  - A unique constraint covering the columns `[receiptNumber,tenantId]` on the table `fee_payments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[studentFeeId,feeComponentId]` on the table `student_fee_components` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `receiptNumber` to the `fee_payments` table without a default value. This is not possible if the table is not empty.
  - Made the column `paidAt` on table `fee_payments` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `name` to the `student_fee_components` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'FEE_COMPONENT';
ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'FEE_ALLOCATION';

-- AlterTable
ALTER TABLE "public"."fee_components" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "currency" SET DEFAULT 'KES';

-- AlterTable
ALTER TABLE "public"."fee_payments" ADD COLUMN     "allocatedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "receiptNumber" TEXT NOT NULL,
ADD COLUMN     "recordedById" TEXT,
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'COMPLETED',
ALTER COLUMN "paidAt" SET NOT NULL,
ALTER COLUMN "paidAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."fee_structures" ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedReason" TEXT;

-- AlterTable
ALTER TABLE "public"."student_fee_components" ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."fee_payment_allocations" (
    "id" TEXT NOT NULL,
    "feePaymentId" TEXT NOT NULL,
    "studentFeeComponentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fee_payment_allocations_feePaymentId_idx" ON "public"."fee_payment_allocations"("feePaymentId");

-- CreateIndex
CREATE INDEX "fee_payment_allocations_studentFeeComponentId_idx" ON "public"."fee_payment_allocations"("studentFeeComponentId");

-- CreateIndex
CREATE INDEX "fee_payments_tenantId_paidAt_idx" ON "public"."fee_payments"("tenantId", "paidAt");

-- CreateIndex
CREATE INDEX "fee_payments_tenantId_paymentMethod_idx" ON "public"."fee_payments"("tenantId", "paymentMethod");

-- CreateIndex
CREATE UNIQUE INDEX "fee_payments_receiptNumber_tenantId_key" ON "public"."fee_payments"("receiptNumber", "tenantId");

-- CreateIndex
CREATE INDEX "fee_structures_tenantId_academicYearId_academicTermId_idx" ON "public"."fee_structures"("tenantId", "academicYearId", "academicTermId");

-- CreateIndex
CREATE INDEX "fee_structures_tenantId_classId_gradeLevel_idx" ON "public"."fee_structures"("tenantId", "classId", "gradeLevel");

-- CreateIndex
CREATE INDEX "student_fee_components_studentFeeId_sortOrder_idx" ON "public"."student_fee_components"("studentFeeId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "student_fee_components_studentFeeId_feeComponentId_key" ON "public"."student_fee_components"("studentFeeId", "feeComponentId");

-- CreateIndex
CREATE INDEX "student_fees_tenantId_status_idx" ON "public"."student_fees"("tenantId", "status");

-- CreateIndex
CREATE INDEX "student_fees_tenantId_studentId_idx" ON "public"."student_fees"("tenantId", "studentId");

-- AddForeignKey
ALTER TABLE "public"."fee_payment_allocations" ADD CONSTRAINT "fee_payment_allocations_feePaymentId_fkey" FOREIGN KEY ("feePaymentId") REFERENCES "public"."fee_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_payment_allocations" ADD CONSTRAINT "fee_payment_allocations_studentFeeComponentId_fkey" FOREIGN KEY ("studentFeeComponentId") REFERENCES "public"."student_fee_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

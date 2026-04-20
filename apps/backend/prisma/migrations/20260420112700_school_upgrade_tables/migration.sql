-- CreateEnum
CREATE TYPE "public"."AcademicPeriodType" AS ENUM ('TERM', 'HOLIDAY', 'EXAM_WEEK', 'MID_TERM_BREAK');

-- CreateEnum
CREATE TYPE "public"."AcademicProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'HOLIDAY', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."PromotionStatus" AS ENUM ('PENDING', 'PROMOTED', 'RETAINED', 'GRADUATED', 'TRANSFERRED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'VOIDED');

-- CreateEnum
CREATE TYPE "public"."DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "public"."DiscountScope" AS ENUM ('TOTAL_FEE', 'COMPONENT');

-- CreateEnum
CREATE TYPE "public"."DiscountStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."AllocationStrategy" AS ENUM ('FIFO', 'PRIORITY', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('FEE_DUE', 'FEE_OVERDUE', 'PAYMENT_RECEIVED', 'TERM_STARTING', 'TERM_ACTIVATED', 'TERM_OVERDUE', 'ACADEMIC_YEAR_ENDING', 'PROMOTION_READY', 'ARREARS_ALERT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "public"."NotificationStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ActivityAction" ADD VALUE 'PROMOTION';
ALTER TYPE "public"."ActivityAction" ADD VALUE 'BILLING';
ALTER TYPE "public"."ActivityAction" ADD VALUE 'WAIVER';
ALTER TYPE "public"."ActivityAction" ADD VALUE 'DISCOUNT';
ALTER TYPE "public"."ActivityAction" ADD VALUE 'FINANCIAL_LOCK';
ALTER TYPE "public"."ActivityAction" ADD VALUE 'ACADEMIC_LOCK';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'ACADEMIC_PERIOD';
ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'STUDENT_CLASS_HISTORY';
ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'FEE_STRUCTURE_VERSION';
ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'INVOICE';
ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'STUDENT_DISCOUNT';
ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'PROMOTION';
ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'NOTIFICATION';

-- AlterEnum
ALTER TYPE "public"."LedgerEntryType" ADD VALUE 'DISCOUNT';

-- AlterEnum
ALTER TYPE "public"."PaymentStatus" ADD VALUE 'VOIDED';

-- AlterTable
ALTER TABLE "public"."academic_terms" ADD COLUMN     "billingGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "billingLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "financiallyLockedAt" TIMESTAMP(3),
ADD COLUMN     "isFinanciallyLocked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."academic_years" ADD COLUMN     "financialLockReason" TEXT,
ADD COLUMN     "financiallyLockedAt" TIMESTAMP(3),
ADD COLUMN     "isFinanciallyLocked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."fee_components" ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "public"."fee_level_components" ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "public"."fee_payments" ADD COLUMN     "allocationStrategy" "public"."AllocationStrategy" NOT NULL DEFAULT 'FIFO',
ADD COLUMN     "overpaymentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."fee_structures" ALTER COLUMN "isAutoBill" SET DEFAULT true,
ALTER COLUMN "scope" SET DEFAULT 'SCHOOL_WIDE';

-- AlterTable
ALTER TABLE "public"."student_fee_components" ADD COLUMN     "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "public"."student_fees" ADD COLUMN     "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "feeStructureVersionId" TEXT,
ADD COLUMN     "isArrears" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "previousBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."tenant_settings" ADD COLUMN     "autoCarryForwardArrears" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "defaultAllocationStrategy" "public"."AllocationStrategy" NOT NULL DEFAULT 'FIFO',
ADD COLUMN     "enableAutoPromotion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "termActivationReminderDays" JSONB NOT NULL DEFAULT '[7,3,1]';

-- CreateTable
CREATE TABLE "public"."academic_periods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."AcademicPeriodType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "academicYearId" TEXT NOT NULL,
    "academicTermId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."student_class_histories" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "stream" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_class_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."student_promotions" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromClassId" TEXT,
    "toClassId" TEXT,
    "academicYearId" TEXT NOT NULL,
    "status" "public"."PromotionStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "promotedById" TEXT,
    "promotedAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fee_structure_versions" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "snapshot" JSONB NOT NULL,
    "changeReason" TEXT,
    "feeStructureId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "fee_structure_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."student_discounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "public"."DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    "scope" "public"."DiscountScope" NOT NULL DEFAULT 'TOTAL_FEE',
    "value" DOUBLE PRECISION NOT NULL,
    "componentName" TEXT,
    "status" "public"."DiscountStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "academicYearId" TEXT,
    "academicTermId" TEXT,
    "approvedById" TEXT,
    "reason" TEXT,
    "studentId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "status" "public"."InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "footerText" TEXT,
    "studentId" TEXT NOT NULL,
    "academicTermId" TEXT,
    "feeStructureId" TEXT,
    "studentFeeId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "channel" "public"."NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "status" "public"."NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "userId" TEXT,
    "tenantId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."report_snapshots" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "academic_periods_tenantId_academicYearId_startDate_endDate_idx" ON "public"."academic_periods"("tenantId", "academicYearId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "academic_periods_tenantId_type_idx" ON "public"."academic_periods"("tenantId", "type");

-- CreateIndex
CREATE INDEX "student_class_histories_tenantId_studentId_isCurrent_idx" ON "public"."student_class_histories"("tenantId", "studentId", "isCurrent");

-- CreateIndex
CREATE INDEX "student_class_histories_tenantId_academicYearId_classId_idx" ON "public"."student_class_histories"("tenantId", "academicYearId", "classId");

-- CreateIndex
CREATE INDEX "student_promotions_tenantId_academicYearId_status_idx" ON "public"."student_promotions"("tenantId", "academicYearId", "status");

-- CreateIndex
CREATE INDEX "fee_structure_versions_tenantId_feeStructureId_isActive_idx" ON "public"."fee_structure_versions"("tenantId", "feeStructureId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "fee_structure_versions_feeStructureId_version_key" ON "public"."fee_structure_versions"("feeStructureId", "version");

-- CreateIndex
CREATE INDEX "student_discounts_tenantId_studentId_status_idx" ON "public"."student_discounts"("tenantId", "studentId", "status");

-- CreateIndex
CREATE INDEX "student_discounts_tenantId_academicYearId_academicTermId_idx" ON "public"."student_discounts"("tenantId", "academicYearId", "academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_studentFeeId_key" ON "public"."invoices"("studentFeeId");

-- CreateIndex
CREATE INDEX "invoices_tenantId_studentId_status_idx" ON "public"."invoices"("tenantId", "studentId", "status");

-- CreateIndex
CREATE INDEX "invoices_tenantId_academicTermId_idx" ON "public"."invoices"("tenantId", "academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_tenantId_key" ON "public"."invoices"("invoiceNumber", "tenantId");

-- CreateIndex
CREATE INDEX "notifications_tenantId_userId_status_idx" ON "public"."notifications"("tenantId", "userId", "status");

-- CreateIndex
CREATE INDEX "notifications_tenantId_type_createdAt_idx" ON "public"."notifications"("tenantId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_scheduledAt_status_idx" ON "public"."notifications"("scheduledAt", "status");

-- CreateIndex
CREATE INDEX "report_snapshots_tenantId_key_validFrom_idx" ON "public"."report_snapshots"("tenantId", "key", "validFrom");

-- CreateIndex
CREATE INDEX "academic_terms_tenantId_isActive_idx" ON "public"."academic_terms"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "academic_years_tenantId_startDate_endDate_idx" ON "public"."academic_years"("tenantId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "public"."audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "classes_tenantId_academicYearId_gradeLevel_idx" ON "public"."classes"("tenantId", "academicYearId", "gradeLevel");

-- CreateIndex
CREATE INDEX "examinations_tenantId_academicTermId_idx" ON "public"."examinations"("tenantId", "academicTermId");

-- CreateIndex
CREATE INDEX "fee_components_feeStructureId_sortOrder_idx" ON "public"."fee_components"("feeStructureId", "sortOrder");

-- CreateIndex
CREATE INDEX "fee_payments_tenantId_status_idx" ON "public"."fee_payments"("tenantId", "status");

-- CreateIndex
CREATE INDEX "student_fee_components_studentFeeId_priority_idx" ON "public"."student_fee_components"("studentFeeId", "priority");

-- CreateIndex
CREATE INDEX "student_fees_tenantId_dueDate_idx" ON "public"."student_fees"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "students_tenantId_classId_academicStatus_idx" ON "public"."students"("tenantId", "classId", "academicStatus");

-- CreateIndex
CREATE INDEX "users_tenantId_isActive_idx" ON "public"."users"("tenantId", "isActive");

-- AddForeignKey
ALTER TABLE "public"."academic_periods" ADD CONSTRAINT "academic_periods_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "public"."academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."academic_periods" ADD CONSTRAINT "academic_periods_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "public"."academic_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."academic_periods" ADD CONSTRAINT "academic_periods_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_class_histories" ADD CONSTRAINT "student_class_histories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_class_histories" ADD CONSTRAINT "student_class_histories_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_class_histories" ADD CONSTRAINT "student_class_histories_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_class_histories" ADD CONSTRAINT "student_class_histories_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "public"."academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_promotions" ADD CONSTRAINT "student_promotions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_promotions" ADD CONSTRAINT "student_promotions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_promotions" ADD CONSTRAINT "student_promotions_fromClassId_fkey" FOREIGN KEY ("fromClassId") REFERENCES "public"."classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_promotions" ADD CONSTRAINT "student_promotions_toClassId_fkey" FOREIGN KEY ("toClassId") REFERENCES "public"."classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_promotions" ADD CONSTRAINT "student_promotions_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "public"."academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structure_versions" ADD CONSTRAINT "fee_structure_versions_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "public"."fee_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structure_versions" ADD CONSTRAINT "fee_structure_versions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_discounts" ADD CONSTRAINT "student_discounts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_discounts" ADD CONSTRAINT "student_discounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "public"."academic_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "public"."fee_structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_studentFeeId_fkey" FOREIGN KEY ("studentFeeId") REFERENCES "public"."student_fees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_snapshots" ADD CONSTRAINT "report_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

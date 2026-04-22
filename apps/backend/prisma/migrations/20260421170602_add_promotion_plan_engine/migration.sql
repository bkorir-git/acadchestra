-- CreateEnum
CREATE TYPE "PromotionPlanStatus" AS ENUM ('DRAFT', 'REVIEWING', 'APPROVED', 'EXECUTING', 'EXECUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PromotionStrategy" AS ENUM ('PRESERVE_STREAM', 'BALANCED_DISTRIBUTION', 'CUSTOM_MAPPING', 'GRADE_ONLY');

-- CreateEnum
CREATE TYPE "PromotionPlanEntryStatus" AS ENUM ('PENDING', 'APPROVED', 'CONFLICTED', 'OVERRIDDEN', 'SKIPPED', 'GRADUATED', 'RETAINED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEntityType" ADD VALUE 'PROMOTION_PLAN';
ALTER TYPE "ActivityEntityType" ADD VALUE 'PROMOTION_PLAN_ENTRY';

-- CreateTable
CREATE TABLE "promotion_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PromotionPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "strategy" "PromotionStrategy" NOT NULL DEFAULT 'PRESERVE_STREAM',
    "fromAcademicYearId" TEXT NOT NULL,
    "toAcademicYearId" TEXT NOT NULL,
    "totalStudents" INTEGER NOT NULL DEFAULT 0,
    "plannedPromotions" INTEGER NOT NULL DEFAULT 0,
    "plannedGraduations" INTEGER NOT NULL DEFAULT 0,
    "plannedRetentions" INTEGER NOT NULL DEFAULT 0,
    "conflictsCount" INTEGER NOT NULL DEFAULT 0,
    "warningsCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "summary" JSONB,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "executedById" TEXT,
    "executedAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_plan_entries" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromClassId" TEXT,
    "suggestedClassId" TEXT,
    "overrideClassId" TEXT,
    "finalClassId" TEXT,
    "fromStream" TEXT,
    "suggestedStream" TEXT,
    "overrideStream" TEXT,
    "finalStream" TEXT,
    "status" "PromotionPlanEntryStatus" NOT NULL DEFAULT 'PENDING',
    "action" TEXT NOT NULL,
    "warnings" JSONB,
    "conflicts" JSONB,
    "adminNotes" TEXT,
    "executedPromotionId" TEXT,
    "executedAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_plan_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotion_plans_tenantId_status_idx" ON "promotion_plans"("tenantId", "status");

-- CreateIndex
CREATE INDEX "promotion_plans_tenantId_toAcademicYearId_idx" ON "promotion_plans"("tenantId", "toAcademicYearId");

-- CreateIndex
CREATE INDEX "promotion_plan_entries_planId_status_idx" ON "promotion_plan_entries"("planId", "status");

-- CreateIndex
CREATE INDEX "promotion_plan_entries_tenantId_studentId_idx" ON "promotion_plan_entries"("tenantId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_plan_entries_planId_studentId_key" ON "promotion_plan_entries"("planId", "studentId");

-- AddForeignKey
ALTER TABLE "promotion_plans" ADD CONSTRAINT "promotion_plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_plan_entries" ADD CONSTRAINT "promotion_plan_entries_planId_fkey" FOREIGN KEY ("planId") REFERENCES "promotion_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

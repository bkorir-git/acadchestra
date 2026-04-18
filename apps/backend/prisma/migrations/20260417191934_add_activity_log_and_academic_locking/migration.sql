-- @description Adds activity feed infrastructure and hardens academic structure lifecycle.

-- CreateEnum
CREATE TYPE "public"."AcademicYearStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED', 'LOCKED');

-- CreateEnum
CREATE TYPE "public"."ActivityAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'PAYMENT', 'LOGIN', 'LOGOUT', 'STATUS_CHANGE', 'ROLE_ASSIGNMENT');

-- CreateEnum
CREATE TYPE "public"."ActivityEntityType" AS ENUM ('TENANT', 'USER', 'ACADEMIC_YEAR', 'ACADEMIC_TERM', 'CLASS', 'STUDENT', 'TEACHER', 'FEE_STRUCTURE', 'STUDENT_FEE', 'FEE_PAYMENT', 'EXAMINATION', 'ROLE');

-- AlterTable
ALTER TABLE "public"."academic_terms" ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedReason" TEXT;

-- AlterTable
ALTER TABLE "public"."academic_years" ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedReason" TEXT,
ADD COLUMN     "status" "public"."AcademicYearStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "public"."activity_logs" (
    "id" TEXT NOT NULL,
    "action" "public"."ActivityAction" NOT NULL,
    "entityType" "public"."ActivityEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "userId" TEXT,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_logs_tenantId_createdAt_idx" ON "public"."activity_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_userId_createdAt_idx" ON "public"."activity_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_action_createdAt_idx" ON "public"."activity_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_entityType_createdAt_idx" ON "public"."activity_logs"("entityType", "createdAt");

-- CreateIndex
CREATE INDEX "academic_terms_tenantId_academicYearId_startDate_endDate_idx" ON "public"."academic_terms"("tenantId", "academicYearId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "academic_years_tenantId_isCurrent_status_idx" ON "public"."academic_years"("tenantId", "isCurrent", "status");

-- AddForeignKey
ALTER TABLE "public"."activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activity_logs" ADD CONSTRAINT "activity_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

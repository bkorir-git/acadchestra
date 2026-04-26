/*
  Warnings:

  - You are about to drop the column `streamsByGrade` on the `academic_years` table. All the data in the column will be lost.
  - You are about to drop the column `curriculum` on the `classes` table. All the data in the column will be lost.
  - You are about to drop the column `gradeLevel` on the `classes` table. All the data in the column will be lost.
  - You are about to drop the column `stream` on the `classes` table. All the data in the column will be lost.
  - You are about to drop the column `gradeLevel` on the `fee_structure_levels` table. All the data in the column will be lost.
  - You are about to drop the column `gradeLevel` on the `fee_structures` table. All the data in the column will be lost.
  - You are about to drop the column `finalStream` on the `promotion_plan_entries` table. All the data in the column will be lost.
  - You are about to drop the column `fromStream` on the `promotion_plan_entries` table. All the data in the column will be lost.
  - You are about to drop the column `overrideStream` on the `promotion_plan_entries` table. All the data in the column will be lost.
  - You are about to drop the column `suggestedStream` on the `promotion_plan_entries` table. All the data in the column will be lost.
  - You are about to drop the column `stream` on the `student_class_histories` table. All the data in the column will be lost.
  - You are about to drop the column `emergencyContact` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `emergencyPhone` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `gradeLevel` on the `subjects` table. All the data in the column will be lost.
  - You are about to drop the column `allowOverpayment` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `allowPartialPayments` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `attendanceThreshold` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `autoCarryForwardArrears` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `customFields` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `defaultAllocationStrategy` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `defaultGradingScale` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `emailSenderAddress` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `emailSenderName` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `enableAutoPromotion` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `enableBulkImport` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `enableEmailNotifications` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `enableLateFees` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `enableOnlinePayments` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `enableParentPortal` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `enablePushNotifications` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `enableSmsNotifications` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `enableStudentPortal` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `enabledPaymentMethods` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `feeReminderDays` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `invoicePrefix` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `lateFeeGraceDays` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `lateFeePercentage` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `lockoutDurationMinutes` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `maxLoginAttempts` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `passingGrade` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `passwordMinLength` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `passwordRequireNumber` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `passwordRequireSymbol` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `passwordRequireUppercase` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `receiptPrefix` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `requirePaymentReference` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `requireTwoFactor` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `sessionTimeoutMinutes` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `smsProvider` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `smsSenderId` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `termActivationReminderDays` on the `tenant_settings` table. All the data in the column will be lost.
  - You are about to drop the column `feeConfiguration` on the `tenants` table. All the data in the column will be lost.
  - You are about to drop the column `gradeStructure` on the `tenants` table. All the data in the column will be lost.
  - Added the required column `gradeId` to the `classes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firstName` to the `students` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `students` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."AdmissionStrategy" AS ENUM ('SEQUENTIAL', 'YEAR_PREFIXED', 'CUSTOM_PREFIXED');

-- CreateEnum
CREATE TYPE "public"."GuardianRelationship" AS ENUM ('MOTHER', 'FATHER', 'STEP_MOTHER', 'STEP_FATHER', 'GUARDIAN', 'GRANDMOTHER', 'GRANDFATHER', 'UNCLE', 'AUNT', 'SIBLING', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."OnboardingStep" AS ENUM ('CURRICULUM', 'ACADEMIC_YEAR', 'CONFIGURATION', 'FIRST_CLASS', 'FIRST_STUDENT', 'FEE_STRUCTURE');

-- CreateEnum
CREATE TYPE "public"."EmailStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'BOUNCED', 'FAILED', 'COMPLAINED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ActivityAction" ADD VALUE 'ONBOARDING_STEP';
ALTER TYPE "public"."ActivityAction" ADD VALUE 'CONFIG_CHANGE';
ALTER TYPE "public"."ActivityAction" ADD VALUE 'CURRICULUM_ADOPTED';
ALTER TYPE "public"."ActivityAction" ADD VALUE 'GUARDIAN_LINKED';
ALTER TYPE "public"."ActivityAction" ADD VALUE 'ADMISSION_ISSUED';
ALTER TYPE "public"."ActivityAction" ADD VALUE 'EMAIL_SENT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'CONFIG';
ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'POLICY';
ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'CURRICULUM';
ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'CURRICULUM_TEMPLATE';
ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'GRADE';
ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'STREAM';
ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'GUARDIAN';
ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'STUDENT_GUARDIAN';
ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'ADMISSION_COUNTER';
ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'FEE_PAYMENT_RULE';
ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'EMAIL_TEMPLATE';
ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'EMAIL_DELIVERY';
ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'ONBOARDING';

-- AlterEnum
ALTER TYPE "public"."ClassType" ADD VALUE 'REMEDIAL';

-- AlterEnum
ALTER TYPE "public"."EmploymentStatus" ADD VALUE 'ON_LEAVE';

-- AlterEnum
ALTER TYPE "public"."ExamType" ADD VALUE 'MOCK';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."FeeStructureScope" ADD VALUE 'CURRICULUM_WIDE';
ALTER TYPE "public"."FeeStructureScope" ADD VALUE 'STREAM_SPECIFIC';

-- AlterEnum
ALTER TYPE "public"."Gender" ADD VALUE 'PREFER_NOT_TO_SAY';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."NotificationType" ADD VALUE 'ONBOARDING_REMINDER';
ALTER TYPE "public"."NotificationType" ADD VALUE 'GUARDIAN_INVITED';
ALTER TYPE "public"."NotificationType" ADD VALUE 'EMAIL_FAILED';

-- AlterEnum
ALTER TYPE "public"."StudentStatus" ADD VALUE 'SUSPENDED';

-- AlterEnum
ALTER TYPE "public"."SubjectCategory" ADD VALUE 'TECHNICAL';

-- DropForeignKey
ALTER TABLE "public"."classes" DROP CONSTRAINT "classes_academicYearId_fkey";

-- DropForeignKey
ALTER TABLE "public"."students" DROP CONSTRAINT "students_userId_fkey";

-- DropIndex
DROP INDEX "public"."classes_tenantId_academicYearId_gradeLevel_idx";

-- DropIndex
DROP INDEX "public"."fee_structure_levels_feeStructureId_gradeLevel_idx";

-- DropIndex
DROP INDEX "public"."fee_structures_tenantId_classId_gradeLevel_idx";

-- AlterTable
ALTER TABLE "public"."academic_years" DROP COLUMN "streamsByGrade";

-- AlterTable
ALTER TABLE "public"."classes" DROP COLUMN "curriculum",
DROP COLUMN "gradeLevel",
DROP COLUMN "stream",
ADD COLUMN     "gradeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."fee_structure_levels" DROP COLUMN "gradeLevel",
ADD COLUMN     "gradeId" TEXT;

-- AlterTable
ALTER TABLE "public"."fee_structures" DROP COLUMN "gradeLevel",
ADD COLUMN     "curriculumId" TEXT,
ADD COLUMN     "gradeId" TEXT,
ADD COLUMN     "streamId" TEXT;

-- AlterTable
ALTER TABLE "public"."promotion_plan_entries" DROP COLUMN "finalStream",
DROP COLUMN "fromStream",
DROP COLUMN "overrideStream",
DROP COLUMN "suggestedStream",
ADD COLUMN     "finalStreamId" TEXT,
ADD COLUMN     "fromStreamId" TEXT,
ADD COLUMN     "overrideStreamId" TEXT,
ADD COLUMN     "suggestedStreamId" TEXT;

-- AlterTable
ALTER TABLE "public"."student_class_histories" DROP COLUMN "stream",
ADD COLUMN     "streamId" TEXT;

-- AlterTable
ALTER TABLE "public"."students" DROP COLUMN "emergencyContact",
DROP COLUMN "emergencyPhone",
ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "email" TEXT,
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "gender" "public"."Gender",
ADD COLUMN     "lastName" TEXT NOT NULL,
ADD COLUMN     "middleName" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "streamId" TEXT,
ALTER COLUMN "rollNumber" DROP NOT NULL,
ALTER COLUMN "admissionDate" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."subjects" DROP COLUMN "gradeLevel",
ADD COLUMN     "gradeId" TEXT;

-- AlterTable
ALTER TABLE "public"."tenant_settings" DROP COLUMN "allowOverpayment",
DROP COLUMN "allowPartialPayments",
DROP COLUMN "attendanceThreshold",
DROP COLUMN "autoCarryForwardArrears",
DROP COLUMN "customFields",
DROP COLUMN "defaultAllocationStrategy",
DROP COLUMN "defaultGradingScale",
DROP COLUMN "emailSenderAddress",
DROP COLUMN "emailSenderName",
DROP COLUMN "enableAutoPromotion",
DROP COLUMN "enableBulkImport",
DROP COLUMN "enableEmailNotifications",
DROP COLUMN "enableLateFees",
DROP COLUMN "enableOnlinePayments",
DROP COLUMN "enableParentPortal",
DROP COLUMN "enablePushNotifications",
DROP COLUMN "enableSmsNotifications",
DROP COLUMN "enableStudentPortal",
DROP COLUMN "enabledPaymentMethods",
DROP COLUMN "feeReminderDays",
DROP COLUMN "invoicePrefix",
DROP COLUMN "lateFeeGraceDays",
DROP COLUMN "lateFeePercentage",
DROP COLUMN "lockoutDurationMinutes",
DROP COLUMN "maxLoginAttempts",
DROP COLUMN "passingGrade",
DROP COLUMN "passwordMinLength",
DROP COLUMN "passwordRequireNumber",
DROP COLUMN "passwordRequireSymbol",
DROP COLUMN "passwordRequireUppercase",
DROP COLUMN "receiptPrefix",
DROP COLUMN "requirePaymentReference",
DROP COLUMN "requireTwoFactor",
DROP COLUMN "sessionTimeoutMinutes",
DROP COLUMN "smsProvider",
DROP COLUMN "smsSenderId",
DROP COLUMN "termActivationReminderDays";

-- AlterTable
ALTER TABLE "public"."tenants" DROP COLUMN "feeConfiguration",
DROP COLUMN "gradeStructure",
ADD COLUMN     "isOnboarded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "onboardingStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- DropEnum
DROP TYPE "public"."AcademicProgressStatus";

-- DropEnum
DROP TYPE "public"."CalendarPhase";

-- CreateTable
CREATE TABLE "public"."configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."policies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."curriculum_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "country" TEXT,
    "description" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "defaultTermStructure" "public"."TermStructure",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curriculum_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."grade_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "levelOrder" INTEGER NOT NULL,
    "curriculumTemplateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grade_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."curriculums" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "templateId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curriculums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."grades" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "levelOrder" INTEGER NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."streams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "color" TEXT,
    "classId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "streams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."admission_counters" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT '',
    "yearPrefix" TEXT,
    "currentSequence" INTEGER NOT NULL DEFAULT 0,
    "paddingLength" INTEGER NOT NULL DEFAULT 4,
    "strategy" "public"."AdmissionStrategy" NOT NULL DEFAULT 'SEQUENTIAL',
    "lastIssuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admission_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."guardians" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "middleName" TEXT,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "altPhone" TEXT,
    "occupation" TEXT,
    "employer" TEXT,
    "address" TEXT,
    "nationalId" TEXT,
    "photoUrl" TEXT,
    "userId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guardians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."student_guardians" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "relationship" "public"."GuardianRelationship" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isEmergencyContact" BOOLEAN NOT NULL DEFAULT false,
    "canPickup" BOOLEAN NOT NULL DEFAULT true,
    "receivesFinancials" BOOLEAN NOT NULL DEFAULT true,
    "receivesAcademics" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_guardians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fee_payment_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "termId" TEXT,
    "byWeek" INTEGER NOT NULL,
    "minPercentage" DOUBLE PRECISION NOT NULL,
    "lateFeePerDay" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_payment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_templates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isHtml" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_deliveries" (
    "id" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "toName" TEXT,
    "subject" TEXT NOT NULL,
    "bodySnapshot" TEXT NOT NULL,
    "status" "public"."EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "context" JSONB,
    "templateId" TEXT,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "configs_tenantId_category_idx" ON "public"."configs"("tenantId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "configs_tenantId_category_key_key" ON "public"."configs"("tenantId", "category", "key");

-- CreateIndex
CREATE INDEX "policies_tenantId_category_isActive_idx" ON "public"."policies"("tenantId", "category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "policies_tenantId_name_key" ON "public"."policies"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_templates_name_key" ON "public"."curriculum_templates"("name");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_templates_code_key" ON "public"."curriculum_templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "grade_templates_curriculumTemplateId_levelOrder_key" ON "public"."grade_templates"("curriculumTemplateId", "levelOrder");

-- CreateIndex
CREATE UNIQUE INDEX "grade_templates_curriculumTemplateId_name_key" ON "public"."grade_templates"("curriculumTemplateId", "name");

-- CreateIndex
CREATE INDEX "curriculums_tenantId_isActive_idx" ON "public"."curriculums"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "curriculums_tenantId_name_key" ON "public"."curriculums"("tenantId", "name");

-- CreateIndex
CREATE INDEX "grades_tenantId_curriculumId_idx" ON "public"."grades"("tenantId", "curriculumId");

-- CreateIndex
CREATE UNIQUE INDEX "grades_tenantId_curriculumId_levelOrder_key" ON "public"."grades"("tenantId", "curriculumId", "levelOrder");

-- CreateIndex
CREATE UNIQUE INDEX "grades_tenantId_curriculumId_name_key" ON "public"."grades"("tenantId", "curriculumId", "name");

-- CreateIndex
CREATE INDEX "streams_tenantId_classId_idx" ON "public"."streams"("tenantId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "streams_classId_name_key" ON "public"."streams"("classId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "admission_counters_tenantId_key" ON "public"."admission_counters"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "guardians_userId_key" ON "public"."guardians"("userId");

-- CreateIndex
CREATE INDEX "guardians_tenantId_phone_idx" ON "public"."guardians"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "guardians_tenantId_email_idx" ON "public"."guardians"("tenantId", "email");

-- CreateIndex
CREATE INDEX "student_guardians_tenantId_studentId_idx" ON "public"."student_guardians"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "student_guardians_tenantId_guardianId_idx" ON "public"."student_guardians"("tenantId", "guardianId");

-- CreateIndex
CREATE UNIQUE INDEX "student_guardians_studentId_guardianId_key" ON "public"."student_guardians"("studentId", "guardianId");

-- CreateIndex
CREATE INDEX "fee_payment_rules_tenantId_termId_isActive_idx" ON "public"."fee_payment_rules"("tenantId", "termId", "isActive");

-- CreateIndex
CREATE INDEX "email_templates_tenantId_isActive_idx" ON "public"."email_templates"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_tenantId_code_key" ON "public"."email_templates"("tenantId", "code");

-- CreateIndex
CREATE INDEX "email_deliveries_tenantId_status_createdAt_idx" ON "public"."email_deliveries"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "email_deliveries_toEmail_idx" ON "public"."email_deliveries"("toEmail");

-- CreateIndex
CREATE INDEX "classes_tenantId_academicYearId_gradeId_idx" ON "public"."classes"("tenantId", "academicYearId", "gradeId");

-- CreateIndex
CREATE INDEX "fee_structure_levels_feeStructureId_gradeId_idx" ON "public"."fee_structure_levels"("feeStructureId", "gradeId");

-- CreateIndex
CREATE INDEX "fee_structures_tenantId_curriculumId_gradeId_idx" ON "public"."fee_structures"("tenantId", "curriculumId", "gradeId");

-- CreateIndex
CREATE INDEX "fee_structures_tenantId_classId_streamId_idx" ON "public"."fee_structures"("tenantId", "classId", "streamId");

-- CreateIndex
CREATE INDEX "students_tenantId_streamId_idx" ON "public"."students"("tenantId", "streamId");

-- CreateIndex
CREATE INDEX "subjects_tenantId_gradeId_idx" ON "public"."subjects"("tenantId", "gradeId");

-- CreateIndex
CREATE INDEX "tenants_isActive_planType_idx" ON "public"."tenants"("isActive", "planType");

-- AddForeignKey
ALTER TABLE "public"."configs" ADD CONSTRAINT "configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."grade_templates" ADD CONSTRAINT "grade_templates_curriculumTemplateId_fkey" FOREIGN KEY ("curriculumTemplateId") REFERENCES "public"."curriculum_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."curriculums" ADD CONSTRAINT "curriculums_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."curriculum_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."curriculums" ADD CONSTRAINT "curriculums_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."grades" ADD CONSTRAINT "grades_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "public"."curriculums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."grades" ADD CONSTRAINT "grades_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."classes" ADD CONSTRAINT "classes_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "public"."grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."classes" ADD CONSTRAINT "classes_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "public"."academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."streams" ADD CONSTRAINT "streams_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."streams" ADD CONSTRAINT "streams_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subjects" ADD CONSTRAINT "subjects_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "public"."grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admission_counters" ADD CONSTRAINT "admission_counters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."students" ADD CONSTRAINT "students_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."students" ADD CONSTRAINT "students_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "public"."streams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."guardians" ADD CONSTRAINT "guardians_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."guardians" ADD CONSTRAINT "guardians_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_guardians" ADD CONSTRAINT "student_guardians_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_guardians" ADD CONSTRAINT "student_guardians_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "public"."guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_guardians" ADD CONSTRAINT "student_guardians_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structures" ADD CONSTRAINT "fee_structures_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "public"."curriculums"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structures" ADD CONSTRAINT "fee_structures_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "public"."grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structures" ADD CONSTRAINT "fee_structures_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "public"."streams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_payment_rules" ADD CONSTRAINT "fee_payment_rules_termId_fkey" FOREIGN KEY ("termId") REFERENCES "public"."academic_terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_payment_rules" ADD CONSTRAINT "fee_payment_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_templates" ADD CONSTRAINT "email_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_deliveries" ADD CONSTRAINT "email_deliveries_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_deliveries" ADD CONSTRAINT "email_deliveries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

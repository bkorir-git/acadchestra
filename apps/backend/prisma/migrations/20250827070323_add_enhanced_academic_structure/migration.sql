-- CreateEnum
CREATE TYPE "public"."TermStructure" AS ENUM ('TWO_SEMESTERS', 'THREE_TERMS', 'FOUR_QUARTERS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."ClassType" AS ENUM ('REGULAR', 'HONORS', 'SPECIAL', 'BILINGUAL', 'VOCATIONAL', 'PREP');

-- CreateEnum
CREATE TYPE "public"."SubjectCategory" AS ENUM ('CORE', 'ELECTIVE', 'LANGUAGE', 'SCIENCE', 'ARTS', 'SPORTS', 'VOCATIONAL');

-- CreateEnum
CREATE TYPE "public"."FeeType" AS ENUM ('ANNUAL', 'TERM_WISE', 'MONTHLY', 'ONE_TIME', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."FeeCategory" AS ENUM ('ACADEMIC', 'FACILITIES', 'TRANSPORT', 'HOSTEL', 'MEALS', 'ACTIVITIES', 'TECHNOLOGY', 'UNIFORM', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."FeeStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'ONLINE', 'CHEQUE', 'MOBILE_MONEY', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."ExamType" AS ENUM ('TERM_EXAM', 'MID_TERM', 'UNIT_TEST', 'ASSESSMENT', 'FINAL_EXAM', 'ENTRANCE');

-- AlterTable
ALTER TABLE "public"."academic_years" ADD COLUMN     "termStructure" "public"."TermStructure" NOT NULL DEFAULT 'THREE_TERMS',
ADD COLUMN     "totalTerms" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "public"."class_subjects" ADD COLUMN     "periodsPerWeek" INTEGER DEFAULT 5;

-- AlterTable
ALTER TABLE "public"."classes" ADD COLUMN     "classType" "public"."ClassType" NOT NULL DEFAULT 'REGULAR',
ADD COLUMN     "curriculum" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "stream" TEXT;

-- AlterTable
ALTER TABLE "public"."subjects" ADD COLUMN     "category" "public"."SubjectCategory" NOT NULL DEFAULT 'CORE',
ADD COLUMN     "department" TEXT;

-- AlterTable
ALTER TABLE "public"."tenants" ADD COLUMN     "feeConfiguration" JSONB,
ADD COLUMN     "gradeStructure" JSONB,
ADD COLUMN     "termStructure" "public"."TermStructure" NOT NULL DEFAULT 'THREE_TERMS';

-- CreateTable
CREATE TABLE "public"."academic_terms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "termNumber" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "hasExams" BOOLEAN NOT NULL DEFAULT true,
    "hasFees" BOOLEAN NOT NULL DEFAULT true,
    "examWeeks" INTEGER NOT NULL DEFAULT 2,
    "academicYearId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fee_structures" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "feeType" "public"."FeeType" NOT NULL DEFAULT 'TERM_WISE',
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "academicYearId" TEXT NOT NULL,
    "academicTermId" TEXT,
    "classId" TEXT,
    "gradeLevel" INTEGER,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fee_components" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isCompulsory" BOOLEAN NOT NULL DEFAULT true,
    "category" "public"."FeeCategory" NOT NULL DEFAULT 'ACADEMIC',
    "dueDate" TIMESTAMP(3),
    "lateFee" DOUBLE PRECISION DEFAULT 0,
    "feeStructureId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."student_fees" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingAmount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "public"."FeeStatus" NOT NULL DEFAULT 'PENDING',
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."student_fee_components" (
    "id" TEXT NOT NULL,
    "studentFeeId" TEXT NOT NULL,
    "feeComponentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "public"."FeeStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_fee_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fee_payments" (
    "id" TEXT NOT NULL,
    "studentFeeId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "public"."PaymentMethod" NOT NULL DEFAULT 'CASH',
    "transactionId" TEXT,
    "referenceNumber" TEXT,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."examinations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."ExamType" NOT NULL DEFAULT 'TERM_EXAM',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER,
    "maxMarks" INTEGER NOT NULL DEFAULT 100,
    "passingMarks" INTEGER NOT NULL DEFAULT 40,
    "academicTermId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "examinations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "academic_terms_academicYearId_termNumber_key" ON "public"."academic_terms"("academicYearId", "termNumber");

-- CreateIndex
CREATE UNIQUE INDEX "academic_terms_name_academicYearId_key" ON "public"."academic_terms"("name", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "student_fees_studentId_feeStructureId_key" ON "public"."student_fees"("studentId", "feeStructureId");

-- AddForeignKey
ALTER TABLE "public"."academic_terms" ADD CONSTRAINT "academic_terms_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "public"."academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."academic_terms" ADD CONSTRAINT "academic_terms_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structures" ADD CONSTRAINT "fee_structures_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "public"."academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structures" ADD CONSTRAINT "fee_structures_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "public"."academic_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structures" ADD CONSTRAINT "fee_structures_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structures" ADD CONSTRAINT "fee_structures_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_components" ADD CONSTRAINT "fee_components_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "public"."fee_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_fees" ADD CONSTRAINT "student_fees_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_fees" ADD CONSTRAINT "student_fees_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "public"."fee_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_fees" ADD CONSTRAINT "student_fees_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_fee_components" ADD CONSTRAINT "student_fee_components_studentFeeId_fkey" FOREIGN KEY ("studentFeeId") REFERENCES "public"."student_fees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_fee_components" ADD CONSTRAINT "student_fee_components_feeComponentId_fkey" FOREIGN KEY ("feeComponentId") REFERENCES "public"."fee_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_payments" ADD CONSTRAINT "fee_payments_studentFeeId_fkey" FOREIGN KEY ("studentFeeId") REFERENCES "public"."student_fees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_payments" ADD CONSTRAINT "fee_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."examinations" ADD CONSTRAINT "examinations_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "public"."academic_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."examinations" ADD CONSTRAINT "examinations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

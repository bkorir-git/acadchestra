-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'SICK', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "AttendanceSessionStatus" AS ENUM ('DRAFT', 'FINALIZED', 'LOCKED');

-- CreateEnum
CREATE TYPE "AttendanceSessionType" AS ENUM ('DAILY', 'SUBJECT', 'AM', 'PM');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEntityType" ADD VALUE 'ATTENDANCE_SESSION';
ALTER TYPE "ActivityEntityType" ADD VALUE 'ATTENDANCE_RECORD';

-- CreateTable
CREATE TABLE "attendance_sessions" (
    "id" TEXT NOT NULL,
    "sessionDate" DATE NOT NULL,
    "type" "AttendanceSessionType" NOT NULL DEFAULT 'DAILY',
    "status" "AttendanceSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "totalStudents" INTEGER NOT NULL DEFAULT 0,
    "presentCount" INTEGER NOT NULL DEFAULT 0,
    "absentCount" INTEGER NOT NULL DEFAULT 0,
    "lateCount" INTEGER NOT NULL DEFAULT 0,
    "excusedCount" INTEGER NOT NULL DEFAULT 0,
    "classId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "academicTermId" TEXT,
    "subjectId" TEXT,
    "takenById" TEXT,
    "takenAt" TIMESTAMP(3),
    "finalizedById" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "lockedAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "remark" TEXT,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markedById" TEXT,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_sessions_tenantId_sessionDate_idx" ON "attendance_sessions"("tenantId", "sessionDate");

-- CreateIndex
CREATE INDEX "attendance_sessions_tenantId_classId_sessionDate_idx" ON "attendance_sessions"("tenantId", "classId", "sessionDate");

-- CreateIndex
CREATE INDEX "attendance_sessions_tenantId_academicYearId_sessionDate_idx" ON "attendance_sessions"("tenantId", "academicYearId", "sessionDate");

-- CreateIndex
CREATE INDEX "attendance_sessions_tenantId_academicTermId_sessionDate_idx" ON "attendance_sessions"("tenantId", "academicTermId", "sessionDate");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_sessions_classId_sessionDate_type_subjectId_key" ON "attendance_sessions"("classId", "sessionDate", "type", "subjectId");

-- CreateIndex
CREATE INDEX "attendance_records_tenantId_studentId_status_idx" ON "attendance_records"("tenantId", "studentId", "status");

-- CreateIndex
CREATE INDEX "attendance_records_tenantId_studentId_createdAt_idx" ON "attendance_records"("tenantId", "studentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_sessionId_studentId_key" ON "attendance_records"("sessionId", "studentId");

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "academic_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

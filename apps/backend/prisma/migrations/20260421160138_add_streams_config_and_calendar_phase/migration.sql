-- CreateEnum
CREATE TYPE "CalendarPhase" AS ENUM ('SETUP', 'TEACHING', 'EXAMS', 'BREAK', 'PROMOTION_WINDOW', 'ARCHIVED');

-- AlterTable
ALTER TABLE "academic_years" ADD COLUMN     "promotionWindowEnd" TIMESTAMP(3),
ADD COLUMN     "promotionWindowStart" TIMESTAMP(3),
ADD COLUMN     "streamsByGrade" JSONB DEFAULT '{}';

-- CreateEnum
CREATE TYPE "public"."PlanType" AS ENUM ('LITE', 'PROFESSIONAL', 'ENTERPRISE', 'MULTI_SCHOOL');

-- CreateEnum
CREATE TYPE "public"."TermStructure" AS ENUM ('TWO_SEMESTERS', 'THREE_TERMS', 'FOUR_QUARTERS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "public"."AcademicYearStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED', 'LOCKED');

-- CreateEnum
CREATE TYPE "public"."AcademicPeriodType" AS ENUM ('TERM', 'HOLIDAY', 'EXAM_WEEK', 'MID_TERM_BREAK');

-- CreateEnum
CREATE TYPE "public"."ClassType" AS ENUM ('REGULAR', 'HONORS', 'SPECIAL', 'BILINGUAL', 'VOCATIONAL', 'PREP', 'REMEDIAL');

-- CreateEnum
CREATE TYPE "public"."AcademicProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'HOLIDAY', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."SubjectCategory" AS ENUM ('CORE', 'ELECTIVE', 'LANGUAGE', 'SCIENCE', 'ARTS', 'SPORTS', 'VOCATIONAL', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "public"."StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED', 'DROPPED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."EmploymentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TERMINATED', 'RESIGNED', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "public"."ExamType" AS ENUM ('TERM_EXAM', 'MID_TERM', 'UNIT_TEST', 'ASSESSMENT', 'FINAL_EXAM', 'ENTRANCE', 'MOCK');

-- CreateEnum
CREATE TYPE "public"."PromotionStatus" AS ENUM ('PENDING', 'PROMOTED', 'RETAINED', 'GRADUATED', 'TRANSFERRED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "public"."FeeType" AS ENUM ('ANNUAL', 'TERM_WISE', 'MONTHLY', 'ONE_TIME', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."FeeCategory" AS ENUM ('ACADEMIC', 'FACILITIES', 'TRANSPORT', 'HOSTEL', 'MEALS', 'ACTIVITIES', 'TECHNOLOGY', 'UNIFORM', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."FeeStructureScope" AS ENUM ('SCHOOL_WIDE', 'CURRICULUM_WIDE', 'GRADE_SPECIFIC', 'CLASS_SPECIFIC', 'STREAM_SPECIFIC');

-- CreateEnum
CREATE TYPE "public"."FeeStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED');

-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'VOIDED');

-- CreateEnum
CREATE TYPE "public"."DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "public"."DiscountScope" AS ENUM ('TOTAL_FEE', 'COMPONENT');

-- CreateEnum
CREATE TYPE "public"."DiscountStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."LedgerEntryType" AS ENUM ('DEBIT', 'CREDIT', 'REVERSAL', 'ADJUSTMENT', 'WAIVER', 'DISCOUNT');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'ONLINE', 'CHEQUE', 'MOBILE_MONEY', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'VOIDED');

-- CreateEnum
CREATE TYPE "public"."AllocationStrategy" AS ENUM ('FIFO', 'PRIORITY', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."CurrencyPosition" AS ENUM ('BEFORE', 'AFTER');

-- CreateEnum
CREATE TYPE "public"."TimeFormat" AS ENUM ('H12', 'H24');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('FEE_DUE', 'FEE_OVERDUE', 'PAYMENT_RECEIVED', 'TERM_STARTING', 'TERM_ACTIVATED', 'TERM_OVERDUE', 'ACADEMIC_YEAR_ENDING', 'PROMOTION_READY', 'ARREARS_ALERT', 'ONBOARDING_REMINDER', 'GUARDIAN_INVITED', 'EMAIL_FAILED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "public"."NotificationStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "public"."ActivityAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'PAYMENT', 'LOGIN', 'LOGOUT', 'STATUS_CHANGE', 'ROLE_ASSIGNMENT', 'PROMOTION', 'BILLING', 'WAIVER', 'DISCOUNT', 'FINANCIAL_LOCK', 'ACADEMIC_LOCK', 'ONBOARDING_STEP', 'CONFIG_CHANGE', 'CURRICULUM_ADOPTED', 'GUARDIAN_LINKED', 'ADMISSION_ISSUED', 'EMAIL_SENT');

-- CreateEnum
CREATE TYPE "public"."ActivityEntityType" AS ENUM ('TENANT', 'TENANT_SETTINGS', 'USER', 'ROLE', 'CONFIG', 'POLICY', 'ACADEMIC_YEAR', 'ACADEMIC_TERM', 'ACADEMIC_PERIOD', 'CURRICULUM', 'CURRICULUM_TEMPLATE', 'GRADE', 'CLASS', 'STREAM', 'STUDENT', 'STUDENT_CLASS_HISTORY', 'GUARDIAN', 'STUDENT_GUARDIAN', 'ADMISSION_COUNTER', 'TEACHER', 'FEE_STRUCTURE', 'FEE_STRUCTURE_VERSION', 'FEE_PAYMENT_RULE', 'STUDENT_FEE', 'FEE_PAYMENT', 'FEE_COMPONENT', 'FEE_ALLOCATION', 'FEE_LEDGER', 'EXAMINATION', 'FEE_STRUCTURE_LEVEL', 'TERM_ACTIVATION_BILLING', 'INVOICE', 'STUDENT_DISCOUNT', 'PROMOTION', 'PROMOTION_PLAN', 'PROMOTION_PLAN_ENTRY', 'ATTENDANCE_SESSION', 'ATTENDANCE_RECORD', 'NOTIFICATION', 'EMAIL_TEMPLATE', 'EMAIL_DELIVERY', 'ONBOARDING', 'UPLOAD_ASSET', 'BACKUP_JOB');

-- CreateEnum
CREATE TYPE "public"."PromotionPlanStatus" AS ENUM ('DRAFT', 'REVIEWING', 'APPROVED', 'EXECUTING', 'EXECUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."PromotionStrategy" AS ENUM ('PRESERVE_STREAM', 'BALANCED_DISTRIBUTION', 'CUSTOM_MAPPING', 'GRADE_ONLY');

-- CreateEnum
CREATE TYPE "public"."PromotionPlanEntryStatus" AS ENUM ('PENDING', 'APPROVED', 'CONFLICTED', 'OVERRIDDEN', 'SKIPPED', 'GRADUATED', 'RETAINED');

-- CreateEnum
CREATE TYPE "public"."AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'SICK', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "public"."AttendanceSessionStatus" AS ENUM ('DRAFT', 'FINALIZED', 'LOCKED');

-- CreateEnum
CREATE TYPE "public"."AttendanceSessionType" AS ENUM ('DAILY', 'SUBJECT', 'AM', 'PM');

-- CreateEnum
CREATE TYPE "public"."AdmissionStrategy" AS ENUM ('SEQUENTIAL', 'YEAR_PREFIXED', 'CUSTOM_PREFIXED');

-- CreateEnum
CREATE TYPE "public"."GuardianRelationship" AS ENUM ('MOTHER', 'FATHER', 'STEP_MOTHER', 'STEP_FATHER', 'GUARDIAN', 'GRANDMOTHER', 'GRANDFATHER', 'UNCLE', 'AUNT', 'SIBLING', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."OnboardingStep" AS ENUM ('CURRICULUM', 'ACADEMIC_YEAR', 'CONFIGURATION', 'FIRST_CLASS', 'FIRST_STUDENT', 'FEE_STRUCTURE');

-- CreateEnum
CREATE TYPE "public"."EmailStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'BOUNCED', 'FAILED', 'COMPLAINED');

-- CreateEnum
CREATE TYPE "public"."UploadCategory" AS ENUM ('TENANT_LOGO', 'TENANT_FAVICON', 'STUDENT_PHOTO', 'STUDENT_DOCUMENT', 'STAFF_PHOTO', 'STAFF_DOCUMENT', 'CERTIFICATE', 'IMPORT_STAGING', 'GENERAL');

-- CreateEnum
CREATE TYPE "public"."UploadStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."BackupType" AS ENUM ('MANUAL', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "public"."BackupStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."BackupArtifactKind" AS ENUM ('DATABASE_DUMP', 'UPLOADS_TARBALL', 'MANIFEST', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "public"."RestoreStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "subdomain" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "logo" TEXT,
    "website" TEXT,
    "planType" "public"."PlanType" NOT NULL DEFAULT 'LITE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxStudents" INTEGER NOT NULL DEFAULT 100,
    "termStructure" "public"."TermStructure" NOT NULL DEFAULT 'THREE_TERMS',
    "isOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "onboardedAt" TIMESTAMP(3),
    "onboardingStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "avatar" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" "public"."Gender",
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isTwoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLogin" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."permissions" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tenant_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "currencySymbol" TEXT NOT NULL DEFAULT 'KSh',
    "currencyPosition" "public"."CurrencyPosition" NOT NULL DEFAULT 'BEFORE',
    "currencyDecimals" INTEGER NOT NULL DEFAULT 2,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Nairobi',
    "locale" TEXT NOT NULL DEFAULT 'en-KE',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "timeFormat" "public"."TimeFormat" NOT NULL DEFAULT 'H24',
    "firstDayOfWeek" INTEGER NOT NULL DEFAULT 1,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#3b82f6',
    "secondaryColor" TEXT NOT NULL DEFAULT '#8b5cf6',
    "brandTagline" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "public"."academic_years" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "termStructure" "public"."TermStructure" NOT NULL DEFAULT 'THREE_TERMS',
    "totalTerms" INTEGER NOT NULL DEFAULT 3,
    "status" "public"."AcademicYearStatus" NOT NULL DEFAULT 'DRAFT',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "lockedReason" TEXT,
    "isFinanciallyLocked" BOOLEAN NOT NULL DEFAULT false,
    "financiallyLockedAt" TIMESTAMP(3),
    "financialLockReason" TEXT,
    "promotionWindowStart" TIMESTAMP(3),
    "promotionWindowEnd" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

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
    "billingGeneratedAt" TIMESTAMP(3),
    "billingLocked" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "lockedReason" TEXT,
    "isFinanciallyLocked" BOOLEAN NOT NULL DEFAULT false,
    "financiallyLockedAt" TIMESTAMP(3),
    "academicYearId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_terms_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "public"."classes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "section" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 40,
    "classType" "public"."ClassType" NOT NULL DEFAULT 'REGULAR',
    "language" TEXT,
    "gradeId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classTeacherId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "public"."subjects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isCompulsory" BOOLEAN NOT NULL DEFAULT true,
    "credits" INTEGER NOT NULL DEFAULT 1,
    "category" "public"."SubjectCategory" NOT NULL DEFAULT 'CORE',
    "department" TEXT,
    "gradeId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."class_subjects" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT,
    "periodsPerWeek" INTEGER DEFAULT 5,

    CONSTRAINT "class_subjects_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "public"."students" (
    "id" TEXT NOT NULL,
    "admissionNumber" TEXT NOT NULL,
    "rollNumber" TEXT,
    "admissionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" "public"."Gender",
    "nationality" TEXT,
    "bloodGroup" TEXT,
    "photoUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "userId" TEXT,
    "classId" TEXT NOT NULL,
    "streamId" TEXT,
    "academicStatus" "public"."StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "public"."student_class_histories" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "streamId" TEXT,
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
CREATE TABLE "public"."promotion_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "public"."PromotionPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "strategy" "public"."PromotionStrategy" NOT NULL DEFAULT 'PRESERVE_STREAM',
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
CREATE TABLE "public"."promotion_plan_entries" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromClassId" TEXT,
    "suggestedClassId" TEXT,
    "overrideClassId" TEXT,
    "finalClassId" TEXT,
    "fromStreamId" TEXT,
    "suggestedStreamId" TEXT,
    "overrideStreamId" TEXT,
    "finalStreamId" TEXT,
    "status" "public"."PromotionPlanEntryStatus" NOT NULL DEFAULT 'PENDING',
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

-- CreateTable
CREATE TABLE "public"."teachers" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "joiningDate" TIMESTAMP(3) NOT NULL,
    "designation" TEXT NOT NULL,
    "department" TEXT,
    "qualification" TEXT,
    "experience" INTEGER,
    "salary" DOUBLE PRECISION,
    "employmentStatus" "public"."EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fee_structures" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "feeType" "public"."FeeType" NOT NULL DEFAULT 'TERM_WISE',
    "scope" "public"."FeeStructureScope" NOT NULL DEFAULT 'SCHOOL_WIDE',
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "isAutoBill" BOOLEAN NOT NULL DEFAULT true,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "lockedReason" TEXT,
    "academicYearId" TEXT NOT NULL,
    "academicTermId" TEXT,
    "curriculumId" TEXT,
    "gradeId" TEXT,
    "classId" TEXT,
    "streamId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_structures_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "public"."fee_components" (
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
    "priority" INTEGER NOT NULL DEFAULT 100,
    "feeStructureId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fee_structure_levels" (
    "id" TEXT NOT NULL,
    "levelLabel" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feeStructureId" TEXT NOT NULL,
    "classId" TEXT,
    "gradeId" TEXT,
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
    "priority" INTEGER NOT NULL DEFAULT 100,
    "feeStructureLevelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_level_components_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "public"."student_fees" (
    "id" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingAmount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "public"."FeeStatus" NOT NULL DEFAULT 'PENDING',
    "previousBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isArrears" BOOLEAN NOT NULL DEFAULT false,
    "studentId" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "feeStructureVersionId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."student_fee_components" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "status" "public"."FeeStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "feeLevelComponentId" TEXT,
    "studentFeeId" TEXT NOT NULL,
    "feeComponentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_fee_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fee_payments" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "allocatedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overpaymentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMethod" "public"."PaymentMethod" NOT NULL DEFAULT 'CASH',
    "allocationStrategy" "public"."AllocationStrategy" NOT NULL DEFAULT 'FIFO',
    "transactionId" TEXT,
    "referenceNumber" TEXT,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "notes" TEXT,
    "recordedById" TEXT,
    "studentFeeId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fee_payment_allocations" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "feePaymentId" TEXT NOT NULL,
    "studentFeeComponentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_payment_allocations_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "public"."attendance_sessions" (
    "id" TEXT NOT NULL,
    "sessionDate" DATE NOT NULL,
    "type" "public"."AttendanceSessionType" NOT NULL DEFAULT 'DAILY',
    "status" "public"."AttendanceSessionStatus" NOT NULL DEFAULT 'DRAFT',
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
CREATE TABLE "public"."attendance_records" (
    "id" TEXT NOT NULL,
    "status" "public"."AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
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
CREATE TABLE "public"."upload_assets" (
    "id" TEXT NOT NULL,
    "category" "public"."UploadCategory" NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "storagePath" TEXT NOT NULL,
    "publicUrl" TEXT,
    "status" "public"."UploadStatus" NOT NULL DEFAULT 'ACTIVE',
    "ownerId" TEXT,
    "ownerType" TEXT,
    "metadata" JSONB,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upload_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."backup_policies" (
    "id" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "scheduleCron" TEXT NOT NULL DEFAULT '0 2 * * *',
    "retentionKeep" INTEGER NOT NULL DEFAULT 5,
    "includeUploads" BOOLEAN NOT NULL DEFAULT true,
    "remoteSync" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backup_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."backup_jobs" (
    "id" TEXT NOT NULL,
    "type" "public"."BackupType" NOT NULL DEFAULT 'MANUAL',
    "status" "public"."BackupStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalSizeBytes" INTEGER,
    "archivePath" TEXT,
    "remoteKey" TEXT,
    "remoteUrl" TEXT,
    "errorMessage" TEXT,
    "triggeredById" TEXT,
    "manifest" JSONB,
    "retainedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backup_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."backup_artifacts" (
    "id" TEXT NOT NULL,
    "kind" "public"."BackupArtifactKind" NOT NULL,
    "path" TEXT NOT NULL,
    "remoteKey" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "backupJobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."restore_jobs" (
    "id" TEXT NOT NULL,
    "status" "public"."RestoreStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "triggeredById" TEXT NOT NULL,
    "confirmationHash" TEXT NOT NULL,
    "notes" TEXT,
    "backupJobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restore_jobs_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "tenants_domain_key" ON "public"."tenants"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_subdomain_key" ON "public"."tenants"("subdomain");

-- CreateIndex
CREATE INDEX "tenants_isActive_planType_idx" ON "public"."tenants"("isActive", "planType");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE INDEX "users_tenantId_isActive_idx" ON "public"."users"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_tenantId_key" ON "public"."roles"("name", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "public"."permissions"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "public"."user_roles"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "public"."role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_tenantId_key" ON "public"."tenant_settings"("tenantId");

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
CREATE INDEX "academic_years_tenantId_isCurrent_status_idx" ON "public"."academic_years"("tenantId", "isCurrent", "status");

-- CreateIndex
CREATE INDEX "academic_years_tenantId_startDate_endDate_idx" ON "public"."academic_years"("tenantId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_name_tenantId_key" ON "public"."academic_years"("name", "tenantId");

-- CreateIndex
CREATE INDEX "academic_terms_tenantId_academicYearId_startDate_endDate_idx" ON "public"."academic_terms"("tenantId", "academicYearId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "academic_terms_tenantId_isActive_idx" ON "public"."academic_terms"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "academic_terms_academicYearId_termNumber_key" ON "public"."academic_terms"("academicYearId", "termNumber");

-- CreateIndex
CREATE UNIQUE INDEX "academic_terms_name_academicYearId_key" ON "public"."academic_terms"("name", "academicYearId");

-- CreateIndex
CREATE INDEX "academic_periods_tenantId_academicYearId_startDate_endDate_idx" ON "public"."academic_periods"("tenantId", "academicYearId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "academic_periods_tenantId_type_idx" ON "public"."academic_periods"("tenantId", "type");

-- CreateIndex
CREATE INDEX "classes_tenantId_academicYearId_gradeId_idx" ON "public"."classes"("tenantId", "academicYearId", "gradeId");

-- CreateIndex
CREATE UNIQUE INDEX "classes_name_academicYearId_tenantId_key" ON "public"."classes"("name", "academicYearId", "tenantId");

-- CreateIndex
CREATE INDEX "streams_tenantId_classId_idx" ON "public"."streams"("tenantId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "streams_classId_name_key" ON "public"."streams"("classId", "name");

-- CreateIndex
CREATE INDEX "subjects_tenantId_gradeId_idx" ON "public"."subjects"("tenantId", "gradeId");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_code_tenantId_key" ON "public"."subjects"("code", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "class_subjects_classId_subjectId_key" ON "public"."class_subjects"("classId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "admission_counters_tenantId_key" ON "public"."admission_counters"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "students_userId_key" ON "public"."students"("userId");

-- CreateIndex
CREATE INDEX "students_tenantId_classId_academicStatus_idx" ON "public"."students"("tenantId", "classId", "academicStatus");

-- CreateIndex
CREATE INDEX "students_tenantId_streamId_idx" ON "public"."students"("tenantId", "streamId");

-- CreateIndex
CREATE UNIQUE INDEX "students_rollNumber_tenantId_key" ON "public"."students"("rollNumber", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "students_admissionNumber_tenantId_key" ON "public"."students"("admissionNumber", "tenantId");

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
CREATE INDEX "student_class_histories_tenantId_studentId_isCurrent_idx" ON "public"."student_class_histories"("tenantId", "studentId", "isCurrent");

-- CreateIndex
CREATE INDEX "student_class_histories_tenantId_academicYearId_classId_idx" ON "public"."student_class_histories"("tenantId", "academicYearId", "classId");

-- CreateIndex
CREATE INDEX "student_promotions_tenantId_academicYearId_status_idx" ON "public"."student_promotions"("tenantId", "academicYearId", "status");

-- CreateIndex
CREATE INDEX "promotion_plans_tenantId_status_idx" ON "public"."promotion_plans"("tenantId", "status");

-- CreateIndex
CREATE INDEX "promotion_plans_tenantId_toAcademicYearId_idx" ON "public"."promotion_plans"("tenantId", "toAcademicYearId");

-- CreateIndex
CREATE INDEX "promotion_plan_entries_planId_status_idx" ON "public"."promotion_plan_entries"("planId", "status");

-- CreateIndex
CREATE INDEX "promotion_plan_entries_tenantId_studentId_idx" ON "public"."promotion_plan_entries"("tenantId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_plan_entries_planId_studentId_key" ON "public"."promotion_plan_entries"("planId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_userId_key" ON "public"."teachers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_employeeId_tenantId_key" ON "public"."teachers"("employeeId", "tenantId");

-- CreateIndex
CREATE INDEX "fee_structures_tenantId_academicYearId_academicTermId_idx" ON "public"."fee_structures"("tenantId", "academicYearId", "academicTermId");

-- CreateIndex
CREATE INDEX "fee_structures_tenantId_curriculumId_gradeId_idx" ON "public"."fee_structures"("tenantId", "curriculumId", "gradeId");

-- CreateIndex
CREATE INDEX "fee_structures_tenantId_classId_streamId_idx" ON "public"."fee_structures"("tenantId", "classId", "streamId");

-- CreateIndex
CREATE INDEX "fee_structures_tenantId_scope_isAutoBill_idx" ON "public"."fee_structures"("tenantId", "scope", "isAutoBill");

-- CreateIndex
CREATE INDEX "fee_structure_versions_tenantId_feeStructureId_isActive_idx" ON "public"."fee_structure_versions"("tenantId", "feeStructureId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "fee_structure_versions_feeStructureId_version_key" ON "public"."fee_structure_versions"("feeStructureId", "version");

-- CreateIndex
CREATE INDEX "fee_components_feeStructureId_sortOrder_idx" ON "public"."fee_components"("feeStructureId", "sortOrder");

-- CreateIndex
CREATE INDEX "fee_structure_levels_feeStructureId_gradeId_idx" ON "public"."fee_structure_levels"("feeStructureId", "gradeId");

-- CreateIndex
CREATE INDEX "fee_structure_levels_tenantId_idx" ON "public"."fee_structure_levels"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "fee_structure_levels_feeStructureId_classId_key" ON "public"."fee_structure_levels"("feeStructureId", "classId");

-- CreateIndex
CREATE INDEX "fee_level_components_feeStructureLevelId_sortOrder_idx" ON "public"."fee_level_components"("feeStructureLevelId", "sortOrder");

-- CreateIndex
CREATE INDEX "fee_payment_rules_tenantId_termId_isActive_idx" ON "public"."fee_payment_rules"("tenantId", "termId", "isActive");

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
CREATE INDEX "student_fees_tenantId_status_idx" ON "public"."student_fees"("tenantId", "status");

-- CreateIndex
CREATE INDEX "student_fees_tenantId_studentId_idx" ON "public"."student_fees"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "student_fees_tenantId_dueDate_idx" ON "public"."student_fees"("tenantId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "student_fees_studentId_feeStructureId_key" ON "public"."student_fees"("studentId", "feeStructureId");

-- CreateIndex
CREATE INDEX "student_fee_components_studentFeeId_sortOrder_idx" ON "public"."student_fee_components"("studentFeeId", "sortOrder");

-- CreateIndex
CREATE INDEX "student_fee_components_studentFeeId_priority_idx" ON "public"."student_fee_components"("studentFeeId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "student_fee_components_studentFeeId_feeComponentId_key" ON "public"."student_fee_components"("studentFeeId", "feeComponentId");

-- CreateIndex
CREATE INDEX "fee_payments_tenantId_paidAt_idx" ON "public"."fee_payments"("tenantId", "paidAt");

-- CreateIndex
CREATE INDEX "fee_payments_tenantId_paymentMethod_idx" ON "public"."fee_payments"("tenantId", "paymentMethod");

-- CreateIndex
CREATE INDEX "fee_payments_tenantId_status_idx" ON "public"."fee_payments"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "fee_payments_receiptNumber_tenantId_key" ON "public"."fee_payments"("receiptNumber", "tenantId");

-- CreateIndex
CREATE INDEX "fee_payment_allocations_feePaymentId_idx" ON "public"."fee_payment_allocations"("feePaymentId");

-- CreateIndex
CREATE INDEX "fee_payment_allocations_studentFeeComponentId_idx" ON "public"."fee_payment_allocations"("studentFeeComponentId");

-- CreateIndex
CREATE INDEX "fee_ledger_tenantId_studentId_occurredAt_idx" ON "public"."fee_ledger"("tenantId", "studentId", "occurredAt");

-- CreateIndex
CREATE INDEX "fee_ledger_tenantId_occurredAt_idx" ON "public"."fee_ledger"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "fee_ledger_tenantId_entryType_idx" ON "public"."fee_ledger"("tenantId", "entryType");

-- CreateIndex
CREATE INDEX "examinations_tenantId_academicTermId_idx" ON "public"."examinations"("tenantId", "academicTermId");

-- CreateIndex
CREATE INDEX "attendance_sessions_tenantId_sessionDate_idx" ON "public"."attendance_sessions"("tenantId", "sessionDate");

-- CreateIndex
CREATE INDEX "attendance_sessions_tenantId_classId_sessionDate_idx" ON "public"."attendance_sessions"("tenantId", "classId", "sessionDate");

-- CreateIndex
CREATE INDEX "attendance_sessions_tenantId_academicYearId_sessionDate_idx" ON "public"."attendance_sessions"("tenantId", "academicYearId", "sessionDate");

-- CreateIndex
CREATE INDEX "attendance_sessions_tenantId_academicTermId_sessionDate_idx" ON "public"."attendance_sessions"("tenantId", "academicTermId", "sessionDate");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_sessions_classId_sessionDate_type_subjectId_key" ON "public"."attendance_sessions"("classId", "sessionDate", "type", "subjectId");

-- CreateIndex
CREATE INDEX "attendance_records_tenantId_studentId_status_idx" ON "public"."attendance_records"("tenantId", "studentId", "status");

-- CreateIndex
CREATE INDEX "attendance_records_tenantId_studentId_createdAt_idx" ON "public"."attendance_records"("tenantId", "studentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_sessionId_studentId_key" ON "public"."attendance_records"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX "email_templates_tenantId_isActive_idx" ON "public"."email_templates"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_tenantId_code_key" ON "public"."email_templates"("tenantId", "code");

-- CreateIndex
CREATE INDEX "email_deliveries_tenantId_status_createdAt_idx" ON "public"."email_deliveries"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "email_deliveries_toEmail_idx" ON "public"."email_deliveries"("toEmail");

-- CreateIndex
CREATE INDEX "notifications_tenantId_userId_status_idx" ON "public"."notifications"("tenantId", "userId", "status");

-- CreateIndex
CREATE INDEX "notifications_tenantId_type_createdAt_idx" ON "public"."notifications"("tenantId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_scheduledAt_status_idx" ON "public"."notifications"("scheduledAt", "status");

-- CreateIndex
CREATE INDEX "upload_assets_tenantId_category_status_idx" ON "public"."upload_assets"("tenantId", "category", "status");

-- CreateIndex
CREATE INDEX "upload_assets_category_status_idx" ON "public"."upload_assets"("category", "status");

-- CreateIndex
CREATE INDEX "backup_jobs_status_createdAt_idx" ON "public"."backup_jobs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "backup_jobs_type_createdAt_idx" ON "public"."backup_jobs"("type", "createdAt");

-- CreateIndex
CREATE INDEX "backup_artifacts_backupJobId_idx" ON "public"."backup_artifacts"("backupJobId");

-- CreateIndex
CREATE INDEX "restore_jobs_status_createdAt_idx" ON "public"."restore_jobs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "report_snapshots_tenantId_key_validFrom_idx" ON "public"."report_snapshots"("tenantId", "key", "validFrom");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "public"."audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_tenantId_createdAt_idx" ON "public"."activity_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_userId_createdAt_idx" ON "public"."activity_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_action_createdAt_idx" ON "public"."activity_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_entityType_createdAt_idx" ON "public"."activity_logs"("entityType", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."roles" ADD CONSTRAINT "roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "public"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenant_settings" ADD CONSTRAINT "tenant_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "public"."academic_years" ADD CONSTRAINT "academic_years_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."academic_terms" ADD CONSTRAINT "academic_terms_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "public"."academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."academic_terms" ADD CONSTRAINT "academic_terms_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."academic_periods" ADD CONSTRAINT "academic_periods_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "public"."academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."academic_periods" ADD CONSTRAINT "academic_periods_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "public"."academic_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."academic_periods" ADD CONSTRAINT "academic_periods_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."classes" ADD CONSTRAINT "classes_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "public"."grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."classes" ADD CONSTRAINT "classes_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "public"."academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."classes" ADD CONSTRAINT "classes_classTeacherId_fkey" FOREIGN KEY ("classTeacherId") REFERENCES "public"."teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."classes" ADD CONSTRAINT "classes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."streams" ADD CONSTRAINT "streams_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."streams" ADD CONSTRAINT "streams_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subjects" ADD CONSTRAINT "subjects_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "public"."grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subjects" ADD CONSTRAINT "subjects_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."class_subjects" ADD CONSTRAINT "class_subjects_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."class_subjects" ADD CONSTRAINT "class_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "public"."subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."class_subjects" ADD CONSTRAINT "class_subjects_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admission_counters" ADD CONSTRAINT "admission_counters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."students" ADD CONSTRAINT "students_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."students" ADD CONSTRAINT "students_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."students" ADD CONSTRAINT "students_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "public"."streams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."students" ADD CONSTRAINT "students_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "public"."promotion_plans" ADD CONSTRAINT "promotion_plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."promotion_plan_entries" ADD CONSTRAINT "promotion_plan_entries_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."promotion_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."teachers" ADD CONSTRAINT "teachers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."teachers" ADD CONSTRAINT "teachers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structures" ADD CONSTRAINT "fee_structures_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "public"."academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structures" ADD CONSTRAINT "fee_structures_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "public"."academic_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structures" ADD CONSTRAINT "fee_structures_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "public"."curriculums"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structures" ADD CONSTRAINT "fee_structures_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "public"."grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structures" ADD CONSTRAINT "fee_structures_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structures" ADD CONSTRAINT "fee_structures_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "public"."streams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structures" ADD CONSTRAINT "fee_structures_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structure_versions" ADD CONSTRAINT "fee_structure_versions_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "public"."fee_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structure_versions" ADD CONSTRAINT "fee_structure_versions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_components" ADD CONSTRAINT "fee_components_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "public"."fee_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structure_levels" ADD CONSTRAINT "fee_structure_levels_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "public"."fee_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structure_levels" ADD CONSTRAINT "fee_structure_levels_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_structure_levels" ADD CONSTRAINT "fee_structure_levels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_level_components" ADD CONSTRAINT "fee_level_components_feeStructureLevelId_fkey" FOREIGN KEY ("feeStructureLevelId") REFERENCES "public"."fee_structure_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_payment_rules" ADD CONSTRAINT "fee_payment_rules_termId_fkey" FOREIGN KEY ("termId") REFERENCES "public"."academic_terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_payment_rules" ADD CONSTRAINT "fee_payment_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "public"."student_fees" ADD CONSTRAINT "student_fees_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_fees" ADD CONSTRAINT "student_fees_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "public"."fee_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_fees" ADD CONSTRAINT "student_fees_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_fee_components" ADD CONSTRAINT "student_fee_components_studentFeeId_fkey" FOREIGN KEY ("studentFeeId") REFERENCES "public"."student_fees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_fee_components" ADD CONSTRAINT "student_fee_components_feeComponentId_fkey" FOREIGN KEY ("feeComponentId") REFERENCES "public"."fee_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_payments" ADD CONSTRAINT "fee_payments_studentFeeId_fkey" FOREIGN KEY ("studentFeeId") REFERENCES "public"."student_fees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_payments" ADD CONSTRAINT "fee_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_payment_allocations" ADD CONSTRAINT "fee_payment_allocations_feePaymentId_fkey" FOREIGN KEY ("feePaymentId") REFERENCES "public"."fee_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_payment_allocations" ADD CONSTRAINT "fee_payment_allocations_studentFeeComponentId_fkey" FOREIGN KEY ("studentFeeComponentId") REFERENCES "public"."student_fee_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_ledger" ADD CONSTRAINT "fee_ledger_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_ledger" ADD CONSTRAINT "fee_ledger_studentFeeId_fkey" FOREIGN KEY ("studentFeeId") REFERENCES "public"."student_fees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_ledger" ADD CONSTRAINT "fee_ledger_feePaymentId_fkey" FOREIGN KEY ("feePaymentId") REFERENCES "public"."fee_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fee_ledger" ADD CONSTRAINT "fee_ledger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."examinations" ADD CONSTRAINT "examinations_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "public"."academic_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."examinations" ADD CONSTRAINT "examinations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attendance_sessions" ADD CONSTRAINT "attendance_sessions_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attendance_sessions" ADD CONSTRAINT "attendance_sessions_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "public"."academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attendance_sessions" ADD CONSTRAINT "attendance_sessions_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "public"."academic_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attendance_sessions" ADD CONSTRAINT "attendance_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attendance_records" ADD CONSTRAINT "attendance_records_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attendance_records" ADD CONSTRAINT "attendance_records_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attendance_records" ADD CONSTRAINT "attendance_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_templates" ADD CONSTRAINT "email_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_deliveries" ADD CONSTRAINT "email_deliveries_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_deliveries" ADD CONSTRAINT "email_deliveries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."upload_assets" ADD CONSTRAINT "upload_assets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."backup_artifacts" ADD CONSTRAINT "backup_artifacts_backupJobId_fkey" FOREIGN KEY ("backupJobId") REFERENCES "public"."backup_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."restore_jobs" ADD CONSTRAINT "restore_jobs_backupJobId_fkey" FOREIGN KEY ("backupJobId") REFERENCES "public"."backup_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_snapshots" ADD CONSTRAINT "report_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activity_logs" ADD CONSTRAINT "activity_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

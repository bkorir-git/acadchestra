-- CreateEnum
CREATE TYPE "public"."CurrencyPosition" AS ENUM ('BEFORE', 'AFTER');

-- CreateEnum
CREATE TYPE "public"."TimeFormat" AS ENUM ('H12', 'H24');

-- AlterEnum
ALTER TYPE "public"."ActivityEntityType" ADD VALUE 'TENANT_SETTINGS';

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
    "defaultGradingScale" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "passingGrade" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "attendanceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 75,
    "receiptPrefix" TEXT NOT NULL DEFAULT 'RCP',
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "enableLateFees" BOOLEAN NOT NULL DEFAULT false,
    "lateFeePercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lateFeeGraceDays" INTEGER NOT NULL DEFAULT 0,
    "enabledPaymentMethods" JSONB NOT NULL DEFAULT '["CASH","MOBILE_MONEY","BANK_TRANSFER","CHEQUE"]',
    "allowPartialPayments" BOOLEAN NOT NULL DEFAULT true,
    "allowOverpayment" BOOLEAN NOT NULL DEFAULT false,
    "requirePaymentReference" BOOLEAN NOT NULL DEFAULT false,
    "enableEmailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "enableSmsNotifications" BOOLEAN NOT NULL DEFAULT false,
    "enablePushNotifications" BOOLEAN NOT NULL DEFAULT false,
    "feeReminderDays" JSONB NOT NULL DEFAULT '[7,3,1]',
    "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 60,
    "passwordMinLength" INTEGER NOT NULL DEFAULT 8,
    "passwordRequireUppercase" BOOLEAN NOT NULL DEFAULT true,
    "passwordRequireNumber" BOOLEAN NOT NULL DEFAULT true,
    "passwordRequireSymbol" BOOLEAN NOT NULL DEFAULT false,
    "requireTwoFactor" BOOLEAN NOT NULL DEFAULT false,
    "maxLoginAttempts" INTEGER NOT NULL DEFAULT 5,
    "lockoutDurationMinutes" INTEGER NOT NULL DEFAULT 15,
    "emailSenderName" TEXT,
    "emailSenderAddress" TEXT,
    "smsProvider" TEXT,
    "smsSenderId" TEXT,
    "enableParentPortal" BOOLEAN NOT NULL DEFAULT true,
    "enableStudentPortal" BOOLEAN NOT NULL DEFAULT true,
    "enableOnlinePayments" BOOLEAN NOT NULL DEFAULT false,
    "enableBulkImport" BOOLEAN NOT NULL DEFAULT true,
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_tenantId_key" ON "public"."tenant_settings"("tenantId");

-- AddForeignKey
ALTER TABLE "public"."tenant_settings" ADD CONSTRAINT "tenant_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "public"."upload_assets" ADD CONSTRAINT "upload_assets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."backup_artifacts" ADD CONSTRAINT "backup_artifacts_backupJobId_fkey" FOREIGN KEY ("backupJobId") REFERENCES "public"."backup_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."restore_jobs" ADD CONSTRAINT "restore_jobs_backupJobId_fkey" FOREIGN KEY ("backupJobId") REFERENCES "public"."backup_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

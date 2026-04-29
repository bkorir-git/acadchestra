/*
  Warnings:

  - You are about to drop the column `publicUrl` on the `upload_assets` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."upload_assets" DROP COLUMN "publicUrl",
ADD COLUMN     "storageDriver" TEXT NOT NULL DEFAULT 'local';

-- CreateIndex
CREATE INDEX "upload_assets_storageDriver_status_idx" ON "public"."upload_assets"("storageDriver", "status");

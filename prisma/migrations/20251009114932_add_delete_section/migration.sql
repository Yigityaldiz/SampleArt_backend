-- CreateEnum
CREATE TYPE "CleanupEntity" AS ENUM ('SAMPLE', 'USER');

-- CreateEnum
CREATE TYPE "CleanupStatus" AS ENUM ('PENDING', 'RUNNING', 'FAILED', 'COMPLETED');

-- AlterTable
ALTER TABLE "collections" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "sample_images" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "samples" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "cleanup_tasks" (
    "id" TEXT NOT NULL,
    "entityType" "CleanupEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB,
    "status" "CleanupStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cleanup_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cleanup_tasks_status_scheduledAt_idx" ON "cleanup_tasks"("status", "scheduledAt");

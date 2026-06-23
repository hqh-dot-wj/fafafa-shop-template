-- AlterTable
ALTER TABLE "sys_job" ADD COLUMN "source_type" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "source_key" VARCHAR(100),
ADD COLUMN "last_synced_at" TIMESTAMP(6);

-- CreateIndex
CREATE UNIQUE INDEX "uk_sys_job_source" ON "sys_job"("source_type", "source_key");

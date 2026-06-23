-- Worker profile formalization and application review flow.
CREATE TYPE "WorkerSource" AS ENUM ('BACKEND', 'APPLICATION');
CREATE TYPE "WorkerApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "WorkerApplicationSource" AS ENUM ('MINIAPP', 'BACKEND');

ALTER TABLE "srv_worker"
  ADD COLUMN "source" "WorkerSource" NOT NULL DEFAULT 'BACKEND',
  ADD COLUMN "service_area" JSONB,
  ADD COLUMN "address" JSONB,
  ADD COLUMN "completion_score" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "remark" VARCHAR(500);

ALTER TABLE "srv_worker_profile"
  ADD COLUMN "experience_years" INTEGER;

CREATE TABLE "srv_worker_application" (
  "application_id" SERIAL NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "member_id" TEXT,
  "worker_id" INTEGER,
  "name" VARCHAR(50) NOT NULL,
  "nick_name" TEXT,
  "phone" VARCHAR(20) NOT NULL,
  "avatar" VARCHAR(500),
  "gender" "Gender" NOT NULL DEFAULT '0',
  "address" JSONB,
  "service_category_ids" JSONB,
  "skill_tags" JSONB,
  "service_area" JSONB,
  "status" "WorkerStatus" NOT NULL DEFAULT '2',
  "is_online" BOOLEAN NOT NULL DEFAULT false,
  "service_radius" INTEGER,
  "experience_years" INTEGER,
  "intro" TEXT,
  "certificates" JSONB,
  "remark" VARCHAR(500),
  "application_source" "WorkerApplicationSource" NOT NULL DEFAULT 'MINIAPP',
  "application_status" "WorkerApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "review_by" VARCHAR(64),
  "review_time" TIMESTAMP(3),
  "review_remark" VARCHAR(500),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "srv_worker_application_pkey" PRIMARY KEY ("application_id")
);

CREATE INDEX "srv_worker_application_tenant_id_application_status_create_time_idx"
  ON "srv_worker_application"("tenant_id", "application_status", "create_time");
CREATE INDEX "srv_worker_application_tenant_id_phone_idx"
  ON "srv_worker_application"("tenant_id", "phone");
CREATE INDEX "srv_worker_application_worker_id_idx"
  ON "srv_worker_application"("worker_id");

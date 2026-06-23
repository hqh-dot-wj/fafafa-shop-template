DO $$
BEGIN
  CREATE TYPE "ReconciliationBizScope" AS ENUM ('PAYMENT', 'SETTLEMENT', 'WITHDRAWAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "StatementBatchStatus" AS ENUM ('INIT', 'NORMALIZED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ReconciliationBatchStatus" AS ENUM ('INIT', 'RUNNING', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ReconciliationResultStatus" AS ENUM ('MATCHED', 'UNMATCHED', 'BUFFERED', 'IGNORED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ReconciliationBufferStatus" AS ENUM ('WAITING', 'RECHECKING', 'MATCHED', 'EXPIRED', 'IGNORED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "fin_reconciliation_issue"
  ADD COLUMN IF NOT EXISTS "batch_id" TEXT,
  ADD COLUMN IF NOT EXISTS "result_id" TEXT,
  ADD COLUMN IF NOT EXISTS "biz_scope" "ReconciliationBizScope",
  ADD COLUMN IF NOT EXISTS "channel_type" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "local_biz_id" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "local_biz_no" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "channel_biz_no" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "transaction_id" VARCHAR(64);

CREATE TABLE IF NOT EXISTS "fin_channel_statement_batch" (
  "id" TEXT NOT NULL,
  "statement_date" DATE NOT NULL,
  "biz_scope" "ReconciliationBizScope" NOT NULL,
  "channel_type" VARCHAR(30) NOT NULL,
  "status" "StatementBatchStatus" NOT NULL DEFAULT 'INIT',
  "source_type" VARCHAR(30) NOT NULL DEFAULT 'GENERATED',
  "file_name" VARCHAR(200),
  "imported_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "remark" VARCHAR(500),
  "raw_payload" JSONB,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fin_channel_statement_batch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "fin_channel_statement_line" (
  "id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "statement_date" DATE NOT NULL,
  "tenant_id" TEXT,
  "biz_scope" "ReconciliationBizScope" NOT NULL,
  "channel_type" VARCHAR(30) NOT NULL,
  "transaction_id" VARCHAR(64),
  "external_no" VARCHAR(100),
  "out_biz_no" VARCHAR(100),
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" VARCHAR(10) NOT NULL DEFAULT 'CNY',
  "status" VARCHAR(30) NOT NULL,
  "trade_time" TIMESTAMP(3),
  "raw_payload" JSONB,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fin_channel_statement_line_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "fin_reconciliation_batch" (
  "id" TEXT NOT NULL,
  "statement_batch_id" TEXT,
  "batch_date" DATE NOT NULL,
  "biz_scope" "ReconciliationBizScope" NOT NULL,
  "channel_type" VARCHAR(30) NOT NULL,
  "status" "ReconciliationBatchStatus" NOT NULL DEFAULT 'INIT',
  "total_count" INTEGER NOT NULL DEFAULT 0,
  "matched_count" INTEGER NOT NULL DEFAULT 0,
  "unmatched_count" INTEGER NOT NULL DEFAULT 0,
  "buffered_count" INTEGER NOT NULL DEFAULT 0,
  "ignored_count" INTEGER NOT NULL DEFAULT 0,
  "remark" VARCHAR(500),
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fin_reconciliation_batch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "fin_reconciliation_result" (
  "id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "biz_scope" "ReconciliationBizScope" NOT NULL,
  "tenant_id" TEXT,
  "channel_type" VARCHAR(30) NOT NULL,
  "local_biz_id" VARCHAR(100),
  "local_biz_no" VARCHAR(100),
  "channel_biz_no" VARCHAR(100),
  "transaction_id" VARCHAR(64),
  "local_amount" DECIMAL(10,2),
  "channel_amount" DECIMAL(10,2),
  "diff_amount" DECIMAL(10,2),
  "status" "ReconciliationResultStatus" NOT NULL DEFAULT 'MATCHED',
  "reason_code" VARCHAR(50),
  "reason_text" VARCHAR(500),
  "issue_id" TEXT,
  "buffer_id" TEXT,
  "matched_at" TIMESTAMP(3),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fin_reconciliation_result_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "fin_reconciliation_buffer" (
  "id" TEXT NOT NULL,
  "biz_scope" "ReconciliationBizScope" NOT NULL,
  "channel_type" VARCHAR(30) NOT NULL,
  "tenant_id" TEXT,
  "local_biz_id" VARCHAR(100),
  "local_biz_no" VARCHAR(100),
  "channel_biz_no" VARCHAR(100),
  "transaction_id" VARCHAR(64),
  "reason_code" VARCHAR(50) NOT NULL,
  "reason_text" VARCHAR(500),
  "first_seen_at" TIMESTAMP(3) NOT NULL,
  "next_check_at" TIMESTAMP(3) NOT NULL,
  "expire_at" TIMESTAMP(3) NOT NULL,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "status" "ReconciliationBufferStatus" NOT NULL DEFAULT 'WAITING',
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fin_reconciliation_buffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fin_channel_statement_batch_statement_date_biz_scope_channe_idx"
  ON "fin_channel_statement_batch"("statement_date", "biz_scope", "channel_type");

CREATE INDEX IF NOT EXISTS "fin_channel_statement_batch_status_idx"
  ON "fin_channel_statement_batch"("status");

CREATE INDEX IF NOT EXISTS "fin_channel_statement_line_batch_id_idx"
  ON "fin_channel_statement_line"("batch_id");

CREATE INDEX IF NOT EXISTS "fin_channel_statement_line_statement_date_biz_scope_channel_idx"
  ON "fin_channel_statement_line"("statement_date", "biz_scope", "channel_type");

CREATE INDEX IF NOT EXISTS "fin_channel_statement_line_transaction_id_idx"
  ON "fin_channel_statement_line"("transaction_id");

CREATE INDEX IF NOT EXISTS "fin_channel_statement_line_out_biz_no_idx"
  ON "fin_channel_statement_line"("out_biz_no");

CREATE INDEX IF NOT EXISTS "fin_reconciliation_batch_statement_batch_id_idx"
  ON "fin_reconciliation_batch"("statement_batch_id");

CREATE INDEX IF NOT EXISTS "fin_reconciliation_batch_batch_date_biz_scope_channel_type_idx"
  ON "fin_reconciliation_batch"("batch_date", "biz_scope", "channel_type");

CREATE INDEX IF NOT EXISTS "fin_reconciliation_batch_status_idx"
  ON "fin_reconciliation_batch"("status");

CREATE INDEX IF NOT EXISTS "fin_reconciliation_result_batch_id_status_idx"
  ON "fin_reconciliation_result"("batch_id", "status");

CREATE INDEX IF NOT EXISTS "fin_reconciliation_result_tenant_id_status_idx"
  ON "fin_reconciliation_result"("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "fin_reconciliation_result_local_biz_no_idx"
  ON "fin_reconciliation_result"("local_biz_no");

CREATE INDEX IF NOT EXISTS "fin_reconciliation_result_transaction_id_idx"
  ON "fin_reconciliation_result"("transaction_id");

CREATE INDEX IF NOT EXISTS "fin_reconciliation_buffer_biz_scope_channel_type_status_idx"
  ON "fin_reconciliation_buffer"("biz_scope", "channel_type", "status");

CREATE INDEX IF NOT EXISTS "fin_reconciliation_buffer_tenant_id_status_idx"
  ON "fin_reconciliation_buffer"("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "fin_reconciliation_buffer_next_check_at_idx"
  ON "fin_reconciliation_buffer"("next_check_at");

CREATE INDEX IF NOT EXISTS "fin_reconciliation_issue_batch_id_idx"
  ON "fin_reconciliation_issue"("batch_id");

CREATE INDEX IF NOT EXISTS "fin_reconciliation_issue_result_id_idx"
  ON "fin_reconciliation_issue"("result_id");

CREATE INDEX IF NOT EXISTS "fin_reconciliation_issue_biz_scope_channel_type_status_idx"
  ON "fin_reconciliation_issue"("biz_scope", "channel_type", "status");

CREATE INDEX IF NOT EXISTS "fin_reconciliation_issue_local_biz_no_idx"
  ON "fin_reconciliation_issue"("local_biz_no");

CREATE INDEX IF NOT EXISTS "fin_reconciliation_issue_transaction_id_idx"
  ON "fin_reconciliation_issue"("transaction_id");

DO $$
BEGIN
  ALTER TABLE "fin_channel_statement_line"
    ADD CONSTRAINT "fin_channel_statement_line_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "fin_channel_statement_batch"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "fin_reconciliation_batch"
    ADD CONSTRAINT "fin_reconciliation_batch_statement_batch_id_fkey"
    FOREIGN KEY ("statement_batch_id") REFERENCES "fin_channel_statement_batch"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "fin_reconciliation_result"
    ADD CONSTRAINT "fin_reconciliation_result_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "fin_reconciliation_batch"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

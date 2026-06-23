-- CreateEnum
CREATE TYPE "SettlementProfileStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "SettlementChannelType" AS ENUM ('WECHAT_PROFITSHARING', 'WECHAT_TRANSFER', 'BANK_TRANSFER', 'OFFLINE_TRANSFER');

-- CreateEnum
CREATE TYPE "SettlementReceiverType" AS ENUM ('TENANT', 'MEMBER', 'MERCHANT', 'BANK_ACCOUNT');

-- CreateEnum
CREATE TYPE "PaymentRecordStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SettlementBillStatus" AS ENUM ('INIT', 'PENDING_REVIEW', 'REJECTED', 'APPROVED', 'EXECUTING', 'SUCCESS', 'FAILED', 'RECONCILING', 'CLOSED');

-- CreateEnum
CREATE TYPE "SettlementExecutionStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('WAITING', 'MATCHED', 'UNMATCHED', 'HANDLED');

-- CreateTable
CREATE TABLE "fin_tenant_settlement_profile" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "default_channel" "SettlementChannelType" NOT NULL DEFAULT 'OFFLINE_TRANSFER',
    "receiver_type" "SettlementReceiverType" NOT NULL DEFAULT 'TENANT',
    "receiver_account" VARCHAR(100),
    "receiver_name" VARCHAR(100),
    "bank_name" VARCHAR(100),
    "bank_account_no" VARCHAR(100),
    "need_manual_review" BOOLEAN NOT NULL DEFAULT true,
    "status" "SettlementProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "remark" VARCHAR(500),
    "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "update_time" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_tenant_settlement_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_order_record" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_sn" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "channel_type" VARCHAR(30) NOT NULL,
    "transaction_id" VARCHAR(64),
    "pay_amount" DECIMAL(10,2) NOT NULL,
    "status" "PaymentRecordStatus" NOT NULL DEFAULT 'PENDING',
    "pay_time" TIMESTAMP(3),
    "raw_payload" JSONB,
    "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "update_time" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_order_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_settlement_bill" (
    "id" TEXT NOT NULL,
    "bill_no" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "pay_record_id" TEXT,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "platform_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "store_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "commission_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cross_tenant_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "channel_type" "SettlementChannelType" NOT NULL,
    "status" "SettlementBillStatus" NOT NULL DEFAULT 'INIT',
    "remark" VARCHAR(500),
    "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "update_time" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_settlement_bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_settlement_bill_item" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "receiver_type" "SettlementReceiverType" NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "receiver_name" VARCHAR(100),
    "channel_type" "SettlementChannelType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" VARCHAR(500),
    "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_settlement_bill_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_settlement_audit_log" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "action" VARCHAR(30) NOT NULL,
    "audit_by" VARCHAR(50) NOT NULL,
    "remark" VARCHAR(500),
    "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_settlement_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_settlement_execution" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "execute_no" TEXT NOT NULL,
    "channel_type" "SettlementChannelType" NOT NULL,
    "status" "SettlementExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "external_no" VARCHAR(100),
    "request_payload" JSONB,
    "response_payload" JSONB,
    "failure_reason" VARCHAR(500),
    "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "update_time" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_settlement_execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_settlement_execution_log" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "stage" VARCHAR(50) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "payload" JSONB,
    "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_settlement_execution_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_reconciliation_issue" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_id" TEXT,
    "bill_id" TEXT,
    "execution_id" TEXT,
    "issue_type" VARCHAR(50) NOT NULL,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'WAITING',
    "diff_amount" DECIMAL(10,2),
    "issue_reason" VARCHAR(500),
    "handled_by" VARCHAR(50),
    "handled_remark" VARCHAR(500),
    "handled_time" TIMESTAMP(3),
    "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "update_time" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_reconciliation_issue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fin_tenant_settlement_profile_tenant_id_key" ON "fin_tenant_settlement_profile"("tenant_id");

-- CreateIndex
CREATE INDEX "fin_tenant_settlement_profile_tenant_id_status_idx" ON "fin_tenant_settlement_profile"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pay_order_record_order_id_key" ON "pay_order_record"("order_id");

-- CreateIndex
CREATE INDEX "pay_order_record_tenant_id_status_idx" ON "pay_order_record"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "pay_order_record_order_sn_idx" ON "pay_order_record"("order_sn");

-- CreateIndex
CREATE UNIQUE INDEX "fin_settlement_bill_bill_no_key" ON "fin_settlement_bill"("bill_no");

-- CreateIndex
CREATE UNIQUE INDEX "fin_settlement_bill_order_id_key" ON "fin_settlement_bill"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_settlement_bill_pay_record_id_key" ON "fin_settlement_bill"("pay_record_id");

-- CreateIndex
CREATE INDEX "fin_settlement_bill_tenant_id_status_idx" ON "fin_settlement_bill"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "fin_settlement_bill_pay_record_id_idx" ON "fin_settlement_bill"("pay_record_id");

-- CreateIndex
CREATE INDEX "fin_settlement_bill_item_bill_id_idx" ON "fin_settlement_bill_item"("bill_id");

-- CreateIndex
CREATE INDEX "fin_settlement_bill_item_tenant_id_receiver_type_idx" ON "fin_settlement_bill_item"("tenant_id", "receiver_type");

-- CreateIndex
CREATE INDEX "fin_settlement_audit_log_bill_id_create_time_idx" ON "fin_settlement_audit_log"("bill_id", "create_time");

-- CreateIndex
CREATE INDEX "fin_settlement_audit_log_tenant_id_create_time_idx" ON "fin_settlement_audit_log"("tenant_id", "create_time");

-- CreateIndex
CREATE UNIQUE INDEX "fin_settlement_execution_execute_no_key" ON "fin_settlement_execution"("execute_no");

-- CreateIndex
CREATE INDEX "fin_settlement_execution_bill_id_status_idx" ON "fin_settlement_execution"("bill_id", "status");

-- CreateIndex
CREATE INDEX "fin_settlement_execution_tenant_id_channel_type_status_idx" ON "fin_settlement_execution"("tenant_id", "channel_type", "status");

-- CreateIndex
CREATE INDEX "fin_settlement_execution_log_execution_id_create_time_idx" ON "fin_settlement_execution_log"("execution_id", "create_time");

-- CreateIndex
CREATE INDEX "fin_settlement_execution_log_tenant_id_create_time_idx" ON "fin_settlement_execution_log"("tenant_id", "create_time");

-- CreateIndex
CREATE INDEX "fin_reconciliation_issue_tenant_id_status_idx" ON "fin_reconciliation_issue"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "fin_reconciliation_issue_order_id_idx" ON "fin_reconciliation_issue"("order_id");

-- CreateIndex
CREATE INDEX "fin_reconciliation_issue_bill_id_idx" ON "fin_reconciliation_issue"("bill_id");

-- CreateIndex
CREATE INDEX "fin_reconciliation_issue_execution_id_idx" ON "fin_reconciliation_issue"("execution_id");

-- AddForeignKey
ALTER TABLE "fin_tenant_settlement_profile" ADD CONSTRAINT "fin_tenant_settlement_profile_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "sys_tenant"("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_order_record" ADD CONSTRAINT "pay_order_record_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "oms_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_settlement_bill" ADD CONSTRAINT "fin_settlement_bill_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "oms_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_settlement_bill" ADD CONSTRAINT "fin_settlement_bill_pay_record_id_fkey" FOREIGN KEY ("pay_record_id") REFERENCES "pay_order_record"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_settlement_bill_item" ADD CONSTRAINT "fin_settlement_bill_item_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "fin_settlement_bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_settlement_audit_log" ADD CONSTRAINT "fin_settlement_audit_log_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "fin_settlement_bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_settlement_execution" ADD CONSTRAINT "fin_settlement_execution_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "fin_settlement_bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_settlement_execution_log" ADD CONSTRAINT "fin_settlement_execution_log_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "fin_settlement_execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

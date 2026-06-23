-- Add fulfillment domain models and stable order-item product type snapshot.

ALTER TABLE "oms_order_item" ADD COLUMN "product_type_snapshot" "ProductType";

CREATE TYPE "FulfillmentType" AS ENUM ('PRODUCT', 'SERVICE');
CREATE TYPE "FulfillmentStatus" AS ENUM (
  'PENDING_SHIPMENT',
  'PARTIALLY_SHIPPED',
  'SHIPPED',
  'RECEIVED',
  'PENDING_ASSIGNMENT',
  'ASSIGNED',
  'ACCEPTED',
  'IN_SERVICE',
  'SERVICE_DONE',
  'VERIFIED',
  'FULFILLED',
  'EXCEPTION',
  'CANCELLED'
);
CREATE TYPE "FulfillmentEventType" AS ENUM (
  'CREATE',
  'SHIP',
  'RECEIVE',
  'FULFILL',
  'ASSIGN',
  'ACCEPT',
  'START',
  'DONE',
  'VERIFY',
  'EXCEPTION',
  'CANCEL',
  'LEGACY_BACKFILL'
);
CREATE TYPE "FulfillmentActorType" AS ENUM ('ADMIN', 'CUSTOMER', 'WORKER', 'SYSTEM');
CREATE TYPE "FulfillmentShipmentStatus" AS ENUM ('CREATED', 'SHIPPED', 'CANCELLED');
CREATE TYPE "FulfillmentAssignmentStatus" AS ENUM ('ASSIGNED', 'ACCEPTED', 'IN_SERVICE', 'DONE', 'CANCELLED');
CREATE TYPE "FulfillmentProofType" AS ENUM ('IMAGE', 'VIDEO', 'TEXT', 'SIGNATURE');

CREATE TABLE "fulfillment_order" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "order_id" TEXT NOT NULL,
  "order_item_id" INTEGER NOT NULL,
  "type" "FulfillmentType" NOT NULL,
  "status" "FulfillmentStatus" NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "exception_reason" VARCHAR(500),
  "completed_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fulfillment_order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fulfillment_event" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "fulfillment_order_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "event_type" "FulfillmentEventType" NOT NULL,
  "from_status" "FulfillmentStatus",
  "to_status" "FulfillmentStatus",
  "actor_type" "FulfillmentActorType" NOT NULL,
  "actor_id" VARCHAR(64),
  "operation_id" VARCHAR(64),
  "payload_json" JSONB,
  "remark" VARCHAR(500),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fulfillment_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fulfillment_shipment" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "fulfillment_order_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "carrier_code" VARCHAR(64),
  "carrier_name" VARCHAR(100),
  "tracking_no" VARCHAR(100),
  "shipped_at" TIMESTAMP(3),
  "status" "FulfillmentShipmentStatus" NOT NULL DEFAULT 'CREATED',
  "remark" VARCHAR(500),
  "created_by" VARCHAR(64),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fulfillment_shipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fulfillment_shipment_item" (
  "id" TEXT NOT NULL,
  "shipment_id" TEXT NOT NULL,
  "fulfillment_order_id" TEXT NOT NULL,
  "order_item_id" INTEGER NOT NULL,
  "sku_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "package_no" VARCHAR(64),
  CONSTRAINT "fulfillment_shipment_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fulfillment_assignment" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "fulfillment_order_id" TEXT NOT NULL,
  "worker_id" INTEGER NOT NULL,
  "status" "FulfillmentAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
  "assigned_at" TIMESTAMP(3),
  "accepted_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "done_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "remark" VARCHAR(500),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fulfillment_assignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fulfillment_proof" (
  "id" TEXT NOT NULL,
  "fulfillment_order_id" TEXT NOT NULL,
  "type" "FulfillmentProofType" NOT NULL,
  "url" TEXT,
  "text" TEXT,
  "payload_json" JSONB,
  "uploaded_by_type" "FulfillmentActorType" NOT NULL,
  "uploaded_by_id" VARCHAR(64),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fulfillment_proof_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uk_fulfillment_order_item_type" ON "fulfillment_order"("tenant_id", "order_id", "order_item_id", "type");
CREATE INDEX "idx_fulfillment_order_status_ctime" ON "fulfillment_order"("tenant_id", "status", "create_time");
CREATE INDEX "idx_fulfillment_order_order" ON "fulfillment_order"("order_id");

CREATE UNIQUE INDEX "uk_fulfillment_event_operation" ON "fulfillment_event"("tenant_id", "fulfillment_order_id", "operation_id", "event_type");
CREATE INDEX "idx_fulfillment_event_order_ctime" ON "fulfillment_event"("tenant_id", "order_id", "create_time");

CREATE INDEX "idx_fulfillment_shipment_order_ctime" ON "fulfillment_shipment"("tenant_id", "order_id", "create_time");
CREATE INDEX "idx_fulfillment_shipment_tracking" ON "fulfillment_shipment"("tracking_no");

CREATE INDEX "idx_fulfillment_shipment_item_fulfillment" ON "fulfillment_shipment_item"("fulfillment_order_id");
CREATE INDEX "idx_fulfillment_shipment_item_order_item" ON "fulfillment_shipment_item"("order_item_id");

CREATE UNIQUE INDEX "uk_fulfillment_assignment_worker" ON "fulfillment_assignment"("fulfillment_order_id", "worker_id");
CREATE INDEX "idx_fulfillment_assignment_worker_status" ON "fulfillment_assignment"("tenant_id", "worker_id", "status");

CREATE INDEX "idx_fulfillment_proof_order_ctime" ON "fulfillment_proof"("fulfillment_order_id", "create_time");

ALTER TABLE "fulfillment_order" ADD CONSTRAINT "fulfillment_order_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "oms_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fulfillment_order" ADD CONSTRAINT "fulfillment_order_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "oms_order_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fulfillment_event" ADD CONSTRAINT "fulfillment_event_fulfillment_order_id_fkey" FOREIGN KEY ("fulfillment_order_id") REFERENCES "fulfillment_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fulfillment_event" ADD CONSTRAINT "fulfillment_event_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "oms_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fulfillment_shipment" ADD CONSTRAINT "fulfillment_shipment_fulfillment_order_id_fkey" FOREIGN KEY ("fulfillment_order_id") REFERENCES "fulfillment_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fulfillment_shipment" ADD CONSTRAINT "fulfillment_shipment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "oms_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fulfillment_shipment_item" ADD CONSTRAINT "fulfillment_shipment_item_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "fulfillment_shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fulfillment_shipment_item" ADD CONSTRAINT "fulfillment_shipment_item_fulfillment_order_id_fkey" FOREIGN KEY ("fulfillment_order_id") REFERENCES "fulfillment_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fulfillment_shipment_item" ADD CONSTRAINT "fulfillment_shipment_item_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "oms_order_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fulfillment_assignment" ADD CONSTRAINT "fulfillment_assignment_fulfillment_order_id_fkey" FOREIGN KEY ("fulfillment_order_id") REFERENCES "fulfillment_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fulfillment_proof" ADD CONSTRAINT "fulfillment_proof_fulfillment_order_id_fkey" FOREIGN KEY ("fulfillment_order_id") REFERENCES "fulfillment_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

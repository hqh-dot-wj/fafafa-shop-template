-- 统一错误事件：支撑前端、后端、业务步骤失败的 traceId/errorId 排查
CREATE TABLE "sys_error_event" (
    "id" TEXT NOT NULL,
    "app" VARCHAR(32) NOT NULL,
    "env" VARCHAR(32),
    "level" VARCHAR(16) NOT NULL,
    "request_id" VARCHAR(100),
    "trace_id" VARCHAR(100),
    "error_id" VARCHAR(100) NOT NULL,
    "tenant_id" VARCHAR(20),
    "user_id" VARCHAR(64),
    "route" VARCHAR(500),
    "method" VARCHAR(16),
    "module" VARCHAR(100),
    "operation_code" VARCHAR(120),
    "step_code" VARCHAR(160),
    "step_name" VARCHAR(120),
    "error_code" VARCHAR(100) NOT NULL,
    "safe_message" VARCHAR(500) NOT NULL,
    "technical_message" TEXT,
    "stack" TEXT,
    "cause" TEXT,
    "metadata" JSONB,
    "duration_ms" INTEGER,
    "source" VARCHAR(32),
    "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_error_event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sys_error_event_error_id_key" ON "sys_error_event"("error_id");
CREATE INDEX "sys_error_event_trace_id_idx" ON "sys_error_event"("trace_id");
CREATE INDEX "sys_error_event_request_id_idx" ON "sys_error_event"("request_id");
CREATE INDEX "sys_error_event_error_code_create_time_idx" ON "sys_error_event"("error_code", "create_time");
CREATE INDEX "sys_error_event_operation_code_step_code_create_time_idx" ON "sys_error_event"("operation_code", "step_code", "create_time");
CREATE INDEX "sys_error_event_tenant_id_create_time_idx" ON "sys_error_event"("tenant_id", "create_time");

-- 业务步骤事件：记录关键流程每一步成功/失败/耗时，失败时通过 error_id 关联错误事件
CREATE TABLE "sys_step_event" (
    "id" TEXT NOT NULL,
    "app" VARCHAR(32) NOT NULL DEFAULT 'backend',
    "request_id" VARCHAR(100),
    "trace_id" VARCHAR(100),
    "error_id" VARCHAR(100),
    "tenant_id" VARCHAR(20),
    "user_id" VARCHAR(64),
    "module" VARCHAR(100),
    "operation_code" VARCHAR(120) NOT NULL,
    "step_code" VARCHAR(160) NOT NULL,
    "step_name" VARCHAR(120) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "message" VARCHAR(500),
    "duration_ms" INTEGER,
    "metadata" JSONB,
    "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_step_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sys_step_event_trace_id_create_time_idx" ON "sys_step_event"("trace_id", "create_time");
CREATE INDEX "sys_step_event_operation_code_step_code_create_time_idx" ON "sys_step_event"("operation_code", "step_code", "create_time");
CREATE INDEX "sys_step_event_tenant_id_create_time_idx" ON "sys_step_event"("tenant_id", "create_time");

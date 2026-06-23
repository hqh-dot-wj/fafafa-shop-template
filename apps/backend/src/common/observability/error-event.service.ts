import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { Result } from 'src/common/response';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { FormatDateFields } from 'src/common/utils';
import { getErrorMessage, getErrorStack } from 'src/common/utils/error';
import { ErrorObservabilityContext, createErrorId, getErrorContext, markErrorEventRecorded } from './error-context';

const PRISMA_TX_KEY = 'PRISMA_TX';

export interface ErrorEventRecordInput extends ErrorObservabilityContext {
  app: 'backend' | 'admin-web' | 'miniapp-client';
  errorCode: string | number;
  safeMessage: string;
  cause?: unknown;
  stack?: string;
}

export interface ErrorEventListQuery {
  pageNum?: number;
  pageSize?: number;
  app?: string;
  level?: string;
  traceId?: string;
  requestId?: string;
  errorId?: string;
  operationCode?: string;
  stepCode?: string;
  errorCode?: string;
  tenantId?: string;
  params?: {
    beginTime?: string;
    endTime?: string;
  };
}

export interface StepEventRecordInput {
  app?: string;
  requestId?: string;
  traceId?: string;
  errorId?: string;
  tenantId?: string;
  userId?: string | number;
  module?: string;
  operationCode: string;
  stepCode: string;
  stepName: string;
  status: 'SUCCESS' | 'FAILED';
  message?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface StepEventListQuery {
  pageNum?: number;
  pageSize?: number;
  traceId?: string;
  errorId?: string;
  operationCode?: string;
  stepCode?: string;
  status?: string;
  tenantId?: string;
}

function clip(value: unknown, max = 4000): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = typeof value === 'string' ? value : safeStringify(value);
  return text.length > max ? text.slice(0, max) : text;
}

function safeStringify(value: unknown): string {
  try {
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function toJson(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return { stringifyFailed: true };
  }
}

function pageArgs(query: { pageNum?: number; pageSize?: number }) {
  const pageNum = Math.max(1, Number(query.pageNum || 1));
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 10)));
  return {
    pageNum,
    pageSize,
    skip: (pageNum - 1) * pageSize,
    take: pageSize,
  };
}

@Injectable()
export class ErrorEventService {
  private readonly logger = new Logger(ErrorEventService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  getRequestId(): string | undefined {
    return this.readCls('requestId');
  }

  getTraceId(): string | undefined {
    return this.readCls('traceId');
  }

  async record(input: ErrorEventRecordInput): Promise<string> {
    const errorId = input.errorId || createErrorId();
    const requestId = input.requestId || this.getRequestId();
    const traceId = input.traceId || this.getTraceId() || requestId;
    const tenantId = input.tenantId || TenantContext.getTenantId() || undefined;

    try {
      await this.runOutsideTransaction(() =>
        this.prisma.sysErrorEvent.create({
          data: {
            app: input.app,
            env: process.env.NODE_ENV || 'development',
            level: input.level || 'error',
            requestId,
            traceId,
            errorId,
            tenantId,
            userId: input.userId !== undefined ? String(input.userId).slice(0, 64) : undefined,
            route: clip(input.route, 500),
            method: clip(input.method, 16),
            module: clip(input.module, 100),
            operationCode: clip(input.operationCode, 120),
            stepCode: clip(input.stepCode, 160),
            stepName: clip(input.stepName, 120),
            errorCode: String(input.errorCode).slice(0, 100),
            safeMessage: input.safeMessage.slice(0, 500),
            technicalMessage: clip(input.technicalMessage, 4000),
            stack: clip(input.stack, 8000),
            cause: clip(input.cause, 8000),
            metadata: toJson(input.metadata),
            durationMs: input.durationMs,
            source: clip(input.source, 32),
          },
        }),
      );
    } catch (error) {
      this.logger.warn(`错误事件写入失败: ${getErrorMessage(error)}`);
    }

    return errorId;
  }

  async recordException(error: unknown, context: ErrorObservabilityContext = {}): Promise<string> {
    const existing = getErrorContext(error);
    if (existing?.recorded && existing.errorId) {
      return existing.errorId;
    }

    const merged: ErrorObservabilityContext = {
      ...existing,
      ...context,
    };
    const safeMessage = merged.safeMessage || getErrorMessage(error) || '操作失败';
    const technicalMessage = merged.technicalMessage || getErrorMessage(error);

    const errorId = await this.record({
      app: merged.app || 'backend',
      level: merged.level || 'error',
      requestId: merged.requestId,
      traceId: merged.traceId,
      errorId: merged.errorId,
      tenantId: merged.tenantId,
      userId: merged.userId,
      route: merged.route,
      method: merged.method,
      module: merged.module,
      operationCode: merged.operationCode,
      stepCode: merged.stepCode,
      stepName: merged.stepName,
      errorCode: merged.errorCode || 'UNHANDLED_ERROR',
      safeMessage,
      technicalMessage,
      stack: getErrorStack(error),
      cause: error,
      durationMs: merged.durationMs,
      metadata: merged.metadata,
      source: merged.source || 'exception',
    });

    markErrorEventRecorded(error, errorId);
    return errorId;
  }

  async recordClientEvent(input: ErrorEventRecordInput, req?: Request): Promise<string> {
    const requestId = input.requestId || this.pickHeader(req, 'x-request-id');
    const traceId = input.traceId || this.pickHeader(req, 'x-trace-id') || requestId;
    const tenantId = input.tenantId || this.pickHeader(req, 'tenant-id') || this.pickHeader(req, 'x-tenant-id');
    return this.record({
      ...input,
      requestId,
      traceId,
      tenantId,
      route: input.route || this.pickHeader(req, 'referer'),
      method: input.method || req?.method,
      source: input.source || 'client',
    });
  }

  async recordStep(input: StepEventRecordInput): Promise<void> {
    try {
      await this.runOutsideTransaction(() =>
        this.prisma.sysStepEvent.create({
          data: {
            app: input.app || 'backend',
            requestId: input.requestId || this.getRequestId(),
            traceId: input.traceId || this.getTraceId() || input.requestId,
            errorId: input.errorId,
            tenantId: input.tenantId || TenantContext.getTenantId() || undefined,
            userId: input.userId !== undefined ? String(input.userId).slice(0, 64) : undefined,
            module: clip(input.module, 100),
            operationCode: input.operationCode.slice(0, 120),
            stepCode: input.stepCode.slice(0, 160),
            stepName: input.stepName.slice(0, 120),
            status: input.status,
            message: clip(input.message, 500),
            durationMs: input.durationMs,
            metadata: toJson(input.metadata),
          },
        }),
      );
    } catch (error) {
      this.logger.warn(`步骤事件写入失败: ${getErrorMessage(error)}`);
    }
  }

  async listErrorEvents(query: ErrorEventListQuery) {
    const page = pageArgs(query);
    const where: Prisma.SysErrorEventWhereInput = {};

    if (query.app) where.app = query.app;
    if (query.level) where.level = query.level;
    if (query.traceId) where.traceId = { contains: query.traceId };
    if (query.requestId) where.requestId = { contains: query.requestId };
    if (query.errorId) where.errorId = { contains: query.errorId };
    if (query.operationCode) where.operationCode = { contains: query.operationCode };
    if (query.stepCode) where.stepCode = { contains: query.stepCode };
    if (query.errorCode) where.errorCode = { contains: query.errorCode };
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.params?.beginTime || query.params?.endTime) {
      where.createTime = {};
      if (query.params.beginTime) where.createTime.gte = new Date(query.params.beginTime);
      if (query.params.endTime) where.createTime.lte = new Date(`${query.params.endTime} 23:59:59`);
    }

    const [rows, total] = await Promise.all([
      this.prisma.sysErrorEvent.findMany({
        where,
        orderBy: { createTime: 'desc' },
        skip: page.skip,
        take: page.take,
      }),
      this.prisma.sysErrorEvent.count({ where }),
    ]);

    return Result.page(FormatDateFields(rows), total, page.pageNum, page.pageSize);
  }

  async listStepEvents(query: StepEventListQuery) {
    const page = pageArgs(query);
    const where: Prisma.SysStepEventWhereInput = {};

    if (query.traceId) where.traceId = { contains: query.traceId };
    if (query.errorId) where.errorId = query.errorId;
    if (query.operationCode) where.operationCode = { contains: query.operationCode };
    if (query.stepCode) where.stepCode = { contains: query.stepCode };
    if (query.status) where.status = query.status;
    if (query.tenantId) where.tenantId = query.tenantId;

    const [rows, total] = await Promise.all([
      this.prisma.sysStepEvent.findMany({
        where,
        orderBy: { createTime: 'desc' },
        skip: page.skip,
        take: page.take,
      }),
      this.prisma.sysStepEvent.count({ where }),
    ]);

    return Result.page(FormatDateFields(rows), total, page.pageNum, page.pageSize);
  }

  private readCls(key: string): string | undefined {
    try {
      if (!this.cls.isActive()) return undefined;
      const value = this.cls.get<string>(key);
      return value || undefined;
    } catch {
      return undefined;
    }
  }

  private pickHeader(req: Request | undefined, key: string): string | undefined {
    const value = req?.headers?.[key.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }

  private async runOutsideTransaction<T>(callback: () => Promise<T>): Promise<T> {
    if (!this.cls.isActive()) {
      return await callback();
    }

    let existingTx: Prisma.TransactionClient | undefined;
    try {
      existingTx = this.cls.get<Prisma.TransactionClient | undefined>(PRISMA_TX_KEY);
    } catch {
      return await callback();
    }

    if (!existingTx) {
      return await callback();
    }

    try {
      this.cls.set(PRISMA_TX_KEY, undefined);
    } catch (error) {
      this.logger.warn(`监控写入切换事务上下文失败: ${getErrorMessage(error)}`);
      return await callback();
    }

    try {
      return await callback();
    } finally {
      try {
        this.cls.set(PRISMA_TX_KEY, existingTx);
      } catch (error) {
        this.logger.warn(`监控写入恢复事务上下文失败: ${getErrorMessage(error)}`);
      }
    }
  }
}

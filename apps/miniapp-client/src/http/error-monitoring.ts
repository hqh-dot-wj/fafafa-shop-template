import type { App } from 'vue';
import type { CustomRequestOptions } from '@/http/types';
import { useLocationStore, useTokenStore } from '@/store';
import { getEnvBaseUrl } from '@/utils';

export interface MiniappErrorContext {
  module?: string;
  operationCode?: string;
  stepCode?: string;
  stepName?: string;
  metadata?: Record<string, unknown>;
  source?: string;
  level?: 'warn' | 'error' | 'fatal';
  durationMs?: number;
}

export interface MiniappErrorInfo {
  code: string | number;
  msg: string;
  message: string;
  requestId?: string;
  traceId?: string;
  errorId?: string;
  operationCode?: string;
  stepCode?: string;
  stepName?: string;
  statusCode?: number;
  stack?: string;
  route?: string;
  method?: string;
}

export function createRequestId() {
  return `req_${createUuid()}`;
}

export function createTraceId() {
  return `trace_${createUuid()}`;
}

export function createClientErrorId() {
  return `cerr_${createUuid()}`;
}

export function normalizeMiniappError(error: unknown, options?: CustomRequestOptions): MiniappErrorInfo {
  const record = toRecord(error);
  const msg = readString(record.msg) || readString(record.message) || readString(record.errMsg) || '操作失败';
  const info: MiniappErrorInfo = {
    code: readCode(record.code ?? record.statusCode),
    msg,
    message: msg,
  };
  const requestId = readString(record.requestId);
  const traceId = readString(record.traceId) || options?.traceId;
  const errorId = readString(record.errorId);
  const operationCode = readString(record.operationCode) || options?.operationCode;
  const stepCode = readString(record.stepCode) || options?.stepCode;
  const stepName = readString(record.stepName) || options?.stepName;
  const statusCode = typeof record.statusCode === 'number' ? record.statusCode : undefined;
  const stack = error instanceof Error ? error.stack : readString(record.stack);
  if (requestId !== undefined) info.requestId = requestId;
  if (traceId !== undefined) info.traceId = traceId;
  if (errorId !== undefined) info.errorId = errorId;
  if (operationCode !== undefined) info.operationCode = operationCode;
  if (stepCode !== undefined) info.stepCode = stepCode;
  if (stepName !== undefined) info.stepName = stepName;
  if (statusCode !== undefined) info.statusCode = statusCode;
  if (stack !== undefined) info.stack = stack;
  if (options?.url !== undefined) info.route = options.url;
  if (options?.method !== undefined) info.method = options.method;
  return info;
}

export function appendTraceToMessage(message: string, error: unknown, options?: CustomRequestOptions) {
  const normalized = normalizeMiniappError(error, options);
  const traceText = normalized.errorId || normalized.traceId || normalized.requestId;
  return traceText ? `${message}（追踪号：${traceText}）` : message;
}

export function toUserErrorMessage(error: unknown, fallback = '操作失败', options?: CustomRequestOptions) {
  const normalized = normalizeMiniappError(error, options);
  return appendTraceToMessage(normalized.msg || fallback, error, options);
}

export function reportActionError(error: unknown, context: MiniappErrorContext = {}) {
  void reportClientError(error, context);
}

export function safeIgnoreActionError(error: unknown, context: MiniappErrorContext = {}) {
  void reportClientError(error, {
    ...context,
    level: context.level || 'warn',
  });
}

export function reportClientError(error: unknown, context: MiniappErrorContext = {}, options?: CustomRequestOptions) {
  const normalized = normalizeMiniappError(error, options);
  const locationStore = useLocationStore();
  const tokenStore = useTokenStore();
  const tenantId = locationStore.currentTenantId || '';
  const traceId = normalized.traceId || createTraceId();
  const errorId = normalized.errorId || createClientErrorId();

  uni.request({
    url: buildReportUrl(),
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      'tenant-id': tenantId,
      'X-Request-Id': normalized.requestId || errorId,
      'X-Trace-Id': traceId,
      ...(tokenStore.tokenInfo?.access_token ? { Authorization: `Bearer ${tokenStore.tokenInfo.access_token}` } : {}),
    },
    data: {
      app: 'miniapp-client',
      level: context.level || (normalized.statusCode && normalized.statusCode < 500 ? 'warn' : 'error'),
      requestId: normalized.requestId,
      traceId,
      errorId,
      tenantId,
      route: normalized.route || getCurrentRoute(),
      method: normalized.method,
      module: context.module,
      operationCode: context.operationCode || normalized.operationCode,
      stepCode: context.stepCode || normalized.stepCode,
      stepName: context.stepName || normalized.stepName,
      errorCode: String(normalized.code),
      safeMessage: clip(normalized.msg, 500),
      technicalMessage: clip(normalized.message, 4000),
      stack: clip(normalized.stack, 8000),
      durationMs: context.durationMs,
      metadata: {
        source: context.source || 'miniapp',
        platform: uni.getSystemInfoSync().platform,
        ...context.metadata,
      },
    },
    fail(reportError) {
      console.warn('report miniapp error failed:', reportError);
    },
  });
}

export function setupGlobalErrorReporting(app: App) {
  app.config.errorHandler = (error, instance, info) => {
    reportClientError(error, {
      module: 'vue',
      operationCode: 'app.runtime',
      stepCode: 'app.runtime.vueError',
      stepName: 'Vue运行时错误',
      source: 'vue-error-handler',
      metadata: {
        info,
        component: instance?.$options?.name,
      },
    });
    console.error(error, instance, info);
  };
}

function buildReportUrl() {
  // #ifdef H5
  if (JSON.parse(import.meta.env.VITE_APP_PROXY_ENABLE)) {
    return `${import.meta.env.VITE_APP_PROXY_PREFIX}/client/error-event`;
  }
  // #endif
  return `${getEnvBaseUrl()}/client/error-event`;
}

function getCurrentRoute() {
  const pages = getCurrentPages();
  const current = pages[pages.length - 1];
  return current?.route ? `/${current.route}` : undefined;
}

function createUuid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function readCode(value: unknown): string | number {
  if (typeof value === 'string' || typeof value === 'number') return value;
  return 'CLIENT_ERROR';
}

function readString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function clip(value: string | undefined, max: number) {
  if (!value) return undefined;
  return value.length > max ? value.slice(0, max) : value;
}

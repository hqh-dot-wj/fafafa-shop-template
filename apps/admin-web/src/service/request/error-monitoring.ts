import type { App } from 'vue';
import type { AxiosError } from 'axios';
import { localStg } from '@/utils/storage';
import { getServiceBaseURL } from '@/utils/service';
import { getStoredTenantId } from './tenant';

type HeaderBag = Record<string, unknown> & {
  get?: (key: string) => unknown;
};

export interface AppErrorInfo {
  message: string;
  technicalMessage?: string;
  stack?: string;
  requestId?: string;
  traceId?: string;
  errorId?: string;
  errorCode: string;
  operationCode?: string;
  stepCode?: string;
  stepName?: string;
  route?: string;
  method?: string;
  status?: number;
  source?: string;
}

export interface ActionStepContext {
  module?: string;
  operationCode?: string;
  stepCode?: string;
  stepName?: string;
  metadata?: Record<string, unknown>;
  source?: string;
  durationMs?: number;
  level?: 'warn' | 'error' | 'fatal';
}

const isHttpProxy = import.meta.env.DEV && import.meta.env.VITE_HTTP_PROXY === 'Y';
const { baseURL } = getServiceBaseURL(import.meta.env, isHttpProxy);

export function createClientErrorId() {
  const uuid = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `cerr_${uuid}`;
}

export function createTraceId() {
  const uuid = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `trace_${uuid}`;
}

export function normalizeAppError(error: unknown): AppErrorInfo {
  const axiosError = toAxiosError(error);
  const responseData = getResponseData(axiosError);

  return {
    ...getMessageInfo(error, responseData),
    ...getTraceInfo(responseData, axiosError),
    ...getOperationInfo(responseData),
    ...getRequestInfo(axiosError),
  };
}

export function appendTraceToMessage(message: string, error: unknown) {
  const normalized = normalizeAppError(error);
  const traceText = normalized.errorId || normalized.traceId || normalized.requestId;
  return traceText ? `${message}（追踪号：${traceText}）` : message;
}

export function getAppErrorMessage(error: unknown, fallback = '操作失败') {
  const normalized = normalizeAppError(error);
  return appendTraceToMessage(normalized.message || fallback, error);
}

export function reportActionError(error: unknown, context: ActionStepContext = {}) {
  reportClientError(error, {
    ...context,
    source: context.source || 'action',
  });
}

export function safeIgnoreActionError(error: unknown, context: ActionStepContext = {}) {
  reportClientError(error, {
    ...context,
    level: context.level || 'warn',
    source: context.source || 'optional-action',
  });
}

export async function withActionStep<T>(context: ActionStepContext, task: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  try {
    return await task();
  } catch (error) {
    reportActionError(error, {
      ...context,
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

export function reportClientError(error: unknown, context: ActionStepContext = {}) {
  const normalized = normalizeAppError(error);
  const errorId = normalized.errorId || createClientErrorId();
  const traceId = normalized.traceId || createTraceId();
  const tenantId = getStoredTenantId();
  const token = localStg.get('token');

  fetch(`${baseURL}/client/error-event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': normalized.requestId || errorId,
      'X-Trace-Id': traceId,
      ...(tenantId ? { 'tenant-id': tenantId } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      app: 'admin-web',
      level: context.level || (normalized.status && normalized.status < 500 ? 'warn' : 'error'),
      requestId: normalized.requestId,
      traceId,
      errorId,
      tenantId: tenantId ?? undefined,
      route: normalized.route || window.location.pathname,
      method: normalized.method,
      module: context.module,
      operationCode: context.operationCode || normalized.operationCode,
      stepCode: context.stepCode || normalized.stepCode,
      stepName: context.stepName || normalized.stepName,
      errorCode: normalized.errorCode,
      safeMessage: clip(normalized.message, 500),
      technicalMessage: clip(normalized.technicalMessage, 4000),
      stack: clip(normalized.stack, 8000),
      durationMs: context.durationMs,
      metadata: {
        source: context.source || normalized.source,
        status: normalized.status,
        location: window.location.href,
        ...context.metadata,
      },
    }),
    keepalive: true,
  }).catch((reportError) => {
    window.console.warn('report client error failed:', reportError);
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
    window.console.error(error, instance, info);
  };

  window.addEventListener('unhandledrejection', (event) => {
    reportClientError(event.reason, {
      module: 'browser',
      operationCode: 'app.runtime',
      stepCode: 'app.runtime.unhandledRejection',
      stepName: '未处理 Promise 异常',
      source: 'unhandledrejection',
    });
  });

  window.addEventListener('error', (event) => {
    reportClientError(event.error || event.message, {
      module: 'browser',
      operationCode: 'app.runtime',
      stepCode: 'app.runtime.windowError',
      stepName: '浏览器运行时错误',
      source: 'window-error',
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });
}

function toAxiosError(error: unknown): AxiosError<App.Service.Response> | undefined {
  if (!error || typeof error !== 'object') return undefined;
  return (error as { isAxiosError?: boolean }).isAxiosError ? (error as AxiosError<App.Service.Response>) : undefined;
}

function getResponseData(error: AxiosError<App.Service.Response> | undefined) {
  return error?.response?.data as Partial<App.Service.Response> | undefined;
}

function getMessageInfo(error: unknown, responseData: Partial<App.Service.Response> | undefined) {
  return {
    message: firstString([responseData?.msg, responseData?.message, getFallbackMessage(error)]) ?? '操作失败',
    technicalMessage: getTechnicalMessage(error),
    stack: error instanceof Error ? error.stack : undefined,
  };
}

function getTraceInfo(
  responseData: Partial<App.Service.Response> | undefined,
  error: AxiosError<App.Service.Response> | undefined,
) {
  return {
    requestId: firstString([responseData?.requestId, pickHeader(error?.response?.headers, 'x-request-id')]),
    traceId: firstString([
      responseData?.traceId,
      pickHeader(error?.response?.headers, 'x-trace-id'),
      pickHeader(error?.config?.headers, 'X-Trace-Id'),
    ]),
    errorId: responseData?.errorId,
    errorCode: String(firstValue([responseData?.code, error?.code, error?.response?.status]) ?? 'CLIENT_ERROR'),
  };
}

function getOperationInfo(responseData: Partial<App.Service.Response> | undefined) {
  return {
    operationCode: responseData?.operationCode,
    stepCode: responseData?.stepCode,
    stepName: responseData?.stepName,
  };
}

function getRequestInfo(error: AxiosError<App.Service.Response> | undefined) {
  return {
    route: firstString([error?.config?.url, window.location.pathname]),
    method: error?.config?.method?.toUpperCase(),
    status: error?.response?.status,
    source: error ? 'request' : 'client',
  };
}

function getFallbackMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

function firstString(values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) return value;
    if (typeof value === 'number') return String(value);
  }
  return undefined;
}

function firstValue(values: unknown[]): unknown {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function pickHeader(headers: unknown, key: string): string | undefined {
  if (!headers || typeof headers !== 'object') return undefined;
  const bag = headers as HeaderBag;
  const value =
    bag.get?.(key) ?? bag.get?.(key.toLowerCase()) ?? bag[key] ?? bag[key.toLowerCase()] ?? bag[key.toUpperCase()];
  if (Array.isArray(value)) return String(value[0]);
  return value === undefined || value === null ? undefined : String(value);
}

function getTechnicalMessage(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function clip(value: string | undefined, max: number) {
  if (!value) return undefined;
  return value.length > max ? value.slice(0, max) : value;
}

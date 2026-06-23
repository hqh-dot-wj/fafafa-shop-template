import { randomUUID } from 'crypto';

export type ErrorEventLevel = 'warn' | 'error' | 'fatal';
export type StepEventStatus = 'SUCCESS' | 'FAILED';

export interface ErrorObservabilityContext {
  app?: 'backend' | 'admin-web' | 'miniapp-client';
  level?: ErrorEventLevel;
  requestId?: string;
  traceId?: string;
  errorId?: string;
  tenantId?: string;
  userId?: string | number;
  route?: string;
  method?: string;
  module?: string;
  operationCode?: string;
  stepCode?: string;
  stepName?: string;
  errorCode?: string | number;
  safeMessage?: string;
  technicalMessage?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  source?: string;
  recorded?: boolean;
}

const ERROR_CONTEXT_KEY = '__errorObservabilityContext';

export function createTraceId(): string {
  return `trace_${randomUUID()}`;
}

export function createRequestId(): string {
  return `req_${randomUUID()}`;
}

export function createErrorId(): string {
  return `err_${randomUUID()}`;
}

export function getErrorContext(error: unknown): ErrorObservabilityContext | undefined {
  if (!error || (typeof error !== 'object' && typeof error !== 'function')) {
    return undefined;
  }
  return (error as Record<string, unknown>)[ERROR_CONTEXT_KEY] as ErrorObservabilityContext | undefined;
}

export function attachErrorContext(error: unknown, context: ErrorObservabilityContext): ErrorObservabilityContext {
  if (!error || (typeof error !== 'object' && typeof error !== 'function')) {
    return context;
  }
  const target = error as Record<string, unknown>;
  const current = (target[ERROR_CONTEXT_KEY] as ErrorObservabilityContext | undefined) ?? {};
  const next = { ...current, ...context };
  Object.defineProperty(target, ERROR_CONTEXT_KEY, {
    value: next,
    enumerable: false,
    configurable: true,
    writable: true,
  });
  return next;
}

export function markErrorEventRecorded(error: unknown, errorId: string): void {
  attachErrorContext(error, { errorId, recorded: true });
}

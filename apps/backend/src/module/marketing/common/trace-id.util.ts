import { randomUUID } from 'crypto';

export interface TraceContextAccessor {
  get?<T = unknown>(key: string): T | undefined;
  getId?(): string;
}

function normalizeTraceId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * 统一解析营销链路 traceId：
 * 1. 优先显式透传
 * 2. 其次读取 CLS traceId/requestId/上下文 ID
 * 3. 最后兜底生成，确保全链路可串联
 */
export function resolveMarketingTraceId(
  explicitTraceId?: string | null,
  context?: TraceContextAccessor,
): string {
  const fromExplicit = normalizeTraceId(explicitTraceId);
  if (fromExplicit) {
    return fromExplicit;
  }

  const fromTraceId = normalizeTraceId(context?.get?.('traceId'));
  if (fromTraceId) {
    return fromTraceId;
  }

  const fromRequestId = normalizeTraceId(context?.get?.('requestId'));
  if (fromRequestId) {
    return fromRequestId;
  }

  const fromContextId = normalizeTraceId(context?.getId?.());
  if (fromContextId) {
    return fromContextId;
  }

  return randomUUID();
}

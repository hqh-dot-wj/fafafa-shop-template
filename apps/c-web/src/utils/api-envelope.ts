/** 后端统一响应信封；code 0 / 200 均视为成功（与 miniapp ResultEnum 一致）。 */

export const API_SUCCESS_CODES = new Set([0, 200]);

export interface ApiEnvelope<T = unknown> {
  code: number;
  msg?: string;
  message?: string;
  data: T;
}

export function readApiMessage(payload: Partial<ApiEnvelope> | null | undefined): string {
  if (!payload) return '请求错误';
  return payload.msg || payload.message || '请求错误';
}

export function unwrapApiData<T>(payload: ApiEnvelope<T>): T {
  if (!API_SUCCESS_CODES.has(payload.code)) {
    const error = new Error(readApiMessage(payload)) as Error & { code?: number; payload?: ApiEnvelope<T> };
    error.code = payload.code;
    error.payload = payload;
    throw error;
  }
  return payload.data;
}

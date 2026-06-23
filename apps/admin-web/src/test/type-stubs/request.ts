export interface TestRequestConfig {
  url: string;
  method?: string;
  params?: unknown;
  data?: unknown;
  headers?: Record<string, unknown>;
  responseType?: string;
  [key: string]: unknown;
}

export type TestFlatResponse<T> = { data: T; error: null } | { data: null; error: unknown };

export interface TestRequest {
  <T = unknown, _R extends string = 'json'>(config: TestRequestConfig): Promise<TestFlatResponse<T>>;
  cancelRequest: (...args: unknown[]) => void;
  cancelAllRequest: (...args: unknown[]) => void;
  state: Record<string, unknown>;
}

async function requestImpl<T = unknown, _R extends string = 'json'>(
  _config: TestRequestConfig,
): Promise<TestFlatResponse<T>> {
  return { data: null, error: new Error('type-only request stub') };
}

export const request: TestRequest = Object.assign(requestImpl, {
  cancelRequest: () => {},
  cancelAllRequest: () => {},
  state: {},
});

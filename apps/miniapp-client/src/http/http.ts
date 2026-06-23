import type { MiniappErrorContext } from './error-monitoring';
import type { CustomRequestOptions, IResponse, RequestQuery } from '@/http/types';
import { nextTick } from 'vue';
import { useTokenStore } from '@/store/token';
import { navigateAfterSessionExpired } from '@/utils/session-expired-navigate';
import { reportClientError, toUserErrorMessage } from './error-monitoring';
import { ResultEnum } from './tools/enum';

let refreshing = false;
let taskQueue: Array<{ retry: () => void; reject: (reason?: unknown) => void }> = [];
let lastRateLimitFallbackToastAt = 0;
const RATE_LIMIT_FALLBACK_TOAST_INTERVAL_MS = 20_000;

function retryQueuedRequests(): void {
  const tasks = [...taskQueue];
  taskQueue = [];
  tasks.forEach((task) => task.retry());
}

function rejectQueuedRequests(reason: unknown): void {
  const tasks = [...taskQueue];
  taskQueue = [];
  tasks.forEach((task) => task.reject(reason));
}

function getHeaderValue(headers: Record<string, unknown> | undefined, headerName: string): string | undefined {
  if (!headers) return undefined;
  const target = headerName.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== target) continue;
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    return undefined;
  }
  return undefined;
}

function maybeShowRateLimitFallbackToast(headers: Record<string, unknown> | undefined): void {
  const fallback = getHeaderValue(headers, 'X-RateLimit-Fallback');
  if (fallback !== 'stale-cache') return;
  const now = Date.now();
  if (now - lastRateLimitFallbackToastAt < RATE_LIMIT_FALLBACK_TOAST_INTERVAL_MS) return;
  lastRateLimitFallbackToastAt = now;
  uni.showToast({
    icon: 'none',
    title: '当前访问较高，已展示缓存结果',
  });
}

function buildErrorContext(options: CustomRequestOptions): MiniappErrorContext {
  const context: MiniappErrorContext = {
    source: 'request',
  };
  const moduleName = options.metadata?.module;
  if (typeof moduleName === 'string') context.module = moduleName;
  if (options.operationCode !== undefined) context.operationCode = options.operationCode;
  if (options.stepCode !== undefined) context.stepCode = options.stepCode;
  if (options.stepName !== undefined) context.stepName = options.stepName;
  if (options.metadata !== undefined) context.metadata = options.metadata;
  return context;
}

function readResponseMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '请求错误';
  const record = payload as Record<string, unknown>;
  if (typeof record.msg === 'string' && record.msg) return record.msg;
  if (typeof record.message === 'string' && record.message) return record.message;
  return '请求错误';
}

function enrichResponseError(
  error: Record<string, unknown>,
  options: CustomRequestOptions,
  res?: UniApp.RequestSuccessCallbackResult,
) {
  const headers = res?.header as Record<string, unknown> | undefined;
  return {
    ...error,
    statusCode: res?.statusCode ?? error.statusCode,
    requestId: error.requestId || getHeaderValue(headers, 'X-Request-Id') || options.requestId,
    traceId: error.traceId || getHeaderValue(headers, 'X-Trace-Id') || options.traceId,
    errorId: error.errorId,
    operationCode: error.operationCode || options.operationCode,
    stepCode: error.stepCode || options.stepCode,
    stepName: error.stepName || options.stepName,
    route: options.url,
    method: options.method,
  };
}

export function http<T>(options: CustomRequestOptions) {
  return new Promise<T>((resolve, reject) => {
    uni.request({
      ...options,
      dataType: 'json',
      // #ifndef MP-WEIXIN
      responseType: 'json',
      // #endif
      success: async (res) => {
        const responseData = res.data as IResponse<T>;
        const { code } = responseData;
        maybeShowRateLimitFallbackToast(res.header as Record<string, unknown> | undefined);

        const isTokenExpired = res.statusCode === 401 || code === 401;

        if (isTokenExpired) {
          const tokenStore = useTokenStore();
          const rt = tokenStore.tokenInfo?.refresh_token;

          if (rt) {
            taskQueue.push({
              retry: () => {
                http<T>(options).then(resolve).catch(reject);
              },
              reject,
            });

            if (refreshing) {
              return;
            }

            refreshing = true;
            try {
              await tokenStore.refreshToken();
              nextTick(() => {
                uni.hideToast();
              });
              retryQueuedRequests();
            } catch (error) {
              nextTick(() => {
                uni.hideToast();
                uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
              });
              await tokenStore.logout();
              rejectQueuedRequests(error);
              setTimeout(() => navigateAfterSessionExpired(), 2000);
            } finally {
              refreshing = false;
            }
            return;
          }

          if (!rt) {
            void tokenStore.logout().finally(() => {
              navigateAfterSessionExpired();
            });
          }

          return reject(res);
        }

        // 处理其他成功状态（HTTP状态码200-299）
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // 处理业务逻辑错误
          if (code !== ResultEnum.Success0 && code !== ResultEnum.Success200) {
            const errorPayload = enrichResponseError(responseData as Record<string, unknown>, options, res);
            reportClientError(errorPayload, buildErrorContext(options), options);
            !options.hideErrorToast &&
              uni.showToast({
                icon: 'none',
                title: toUserErrorMessage(errorPayload, readResponseMessage(responseData), options),
              });
            return reject(errorPayload);
          }
          return resolve(responseData.data);
        }

        // 处理其他错误
        const httpError = enrichResponseError(
          (res.data || { code: res.statusCode, msg: '请求错误' }) as Record<string, unknown>,
          options,
          res,
        );
        reportClientError(httpError, buildErrorContext(options), options);
        !options.hideErrorToast &&
          uni.showToast({
            icon: 'none',
            title: toUserErrorMessage(httpError, readResponseMessage(res.data), options),
          });
        reject(httpError);
      },
      // 响应失败
      fail(err) {
        const networkError = enrichResponseError(
          {
            ...err,
            code: 'NETWORK_ERROR',
            msg: '网络错误，换个网络试试',
          },
          options,
        );
        reportClientError(networkError, buildErrorContext(options), options);
        !options.hideErrorToast &&
          uni.showToast({
            icon: 'none',
            title: toUserErrorMessage(networkError, '网络错误，换个网络试试', options),
          });
        reject(networkError);
      },
    });
  });
}

/**
 * GET 请求
 * @param url 后台地址
 * @param query 请求query参数
 * @param header 请求头，默认为json格式
 * @returns
 */
export function httpGet<T>(
  url: string,
  query?: RequestQuery,
  header?: Record<string, unknown>,
  options?: Partial<CustomRequestOptions>,
) {
  const requestOptions: CustomRequestOptions = {
    url,
    method: 'GET',
  };
  if (query !== undefined) requestOptions.query = query;
  if (header !== undefined) requestOptions.header = header;
  if (options) Object.assign(requestOptions, options);
  return http<T>(requestOptions);
}

/**
 * POST 请求
 * @param url 后台地址
 * @param data 请求body参数
 * @param query 请求query参数，post请求也支持query，很多微信接口都需要
 * @param header 请求头，默认为json格式
 * @returns
 */
export function httpPost<T>(
  url: string,
  data?: unknown,
  query?: RequestQuery,
  header?: Record<string, unknown>,
  options?: Partial<CustomRequestOptions>,
) {
  const requestOptions: CustomRequestOptions = {
    url,
    method: 'POST',
  };
  if (query !== undefined) requestOptions.query = query;
  if (data !== undefined) requestOptions.data = data;
  if (header !== undefined) requestOptions.header = header;
  if (options) Object.assign(requestOptions, options);
  return http<T>(requestOptions);
}
/**
 * PUT 请求
 */
export function httpPut<T>(
  url: string,
  data?: unknown,
  query?: RequestQuery,
  header?: Record<string, unknown>,
  options?: Partial<CustomRequestOptions>,
) {
  const requestOptions: CustomRequestOptions = {
    url,
    method: 'PUT',
  };
  if (data !== undefined) requestOptions.data = data;
  if (query !== undefined) requestOptions.query = query;
  if (header !== undefined) requestOptions.header = header;
  if (options) Object.assign(requestOptions, options);
  return http<T>(requestOptions);
}

/**
 * DELETE 请求（无请求体，仅 query）
 */
export function httpDelete<T>(
  url: string,
  query?: RequestQuery,
  header?: Record<string, unknown>,
  options?: Partial<CustomRequestOptions>,
) {
  const requestOptions: CustomRequestOptions = {
    url,
    method: 'DELETE',
  };
  if (query !== undefined) requestOptions.query = query;
  if (header !== undefined) requestOptions.header = header;
  if (options) Object.assign(requestOptions, options);
  return http<T>(requestOptions);
}

// 支持与 axios 类似的API调用
http.get = httpGet;
http.post = httpPost;
http.put = httpPut;
http.delete = httpDelete;

// 支持与 alovaJS 类似的API调用
http.Get = httpGet;
http.Post = httpPost;
http.Put = httpPut;
http.Delete = httpDelete;

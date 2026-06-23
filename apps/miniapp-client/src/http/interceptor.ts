import type { CustomRequestOptions } from '@/http/types';
import { useTokenStore } from '@/store';
import { useLocationStore } from '@/store/location';
import { getEnvBaseUrl } from '@/utils';
import { DEV_MOCK_SUPER_TENANT_ID, isDevLocationMockEnabled, resolveDevMockTenantId } from '@/utils/dev-location-mock';
import { createRequestId, createTraceId } from './error-monitoring';
import { stringifyQuery } from './tools/queryString';

// 请求基准地址
const baseUrl = getEnvBaseUrl();

// 拦截器配置
const httpInterceptor = {
  // 拦截前触发
  invoke(options: CustomRequestOptions) {
    // 如果您使用了alova，则请把下面的代码放开注释
    // alova 执行流程：alova beforeRequest --> 本拦截器 --> alova responded
    // return options

    // 非 alova 请求，正常执行
    // 接口请求支持通过 query 参数配置 queryString
    if (options.query) {
      const queryStr = stringifyQuery(options.query);
      if (options.url.includes('?')) {
        options.url += `&${queryStr}`;
      } else {
        options.url += `?${queryStr}`;
      }
    }
    // 非 http 开头需拼接地址
    if (!options.url.startsWith('http')) {
      // #ifdef H5
      if (JSON.parse(import.meta.env.VITE_APP_PROXY_ENABLE)) {
        // 自动拼接代理前缀
        options.url = import.meta.env.VITE_APP_PROXY_PREFIX + options.url;
      } else {
        options.url = baseUrl + options.url;
      }
      // #endif
      // 非H5正常拼接
      // #ifndef H5
      options.url = baseUrl + options.url;
      // #endif
      // TIPS: 如果需要对接多个后端服务，也可以在这里处理，拼接成所需要的地址
    }
    // 1. 请求超时：默认缩短首屏可感知等待；单请求可显式覆盖（并做上下限夹紧）
    if (typeof options.timeout === 'number' && Number.isFinite(options.timeout) && options.timeout > 0) {
      options.timeout = Math.min(120_000, Math.max(800, Math.trunc(options.timeout)));
    } else {
      options.timeout = 15_000;
    }

    // 2. 添加请求头
    const tokenStore = useTokenStore();
    const locationStore = useLocationStore();
    let tenantId = locationStore.currentTenantId || (isDevLocationMockEnabled() ? resolveDevMockTenantId() : '');
    // H5 未定位前默认超级租户，避免 tenant-id 为空导致部分接口 403
    // #ifdef H5
    if (!tenantId) {
      tenantId = DEV_MOCK_SUPER_TENANT_ID;
    }
    // #endif
    const token = tokenStore.updateNowTime().validToken;
    const requestId = options.requestId || createRequestId();
    const traceId = options.traceId || createTraceId();

    options.header = {
      ...options.header,
      // 租户ID (复用后端 TenantMiddleware)
      'tenant-id': tenantId,
      'X-Request-Id': requestId,
      'X-Trace-Id': traceId,
    };
    options.requestId = requestId;
    options.traceId = traceId;

    // 3. 添加 token 请求头标识
    if (token) {
      options.header.Authorization = `Bearer ${token}`;
    }
    return options;
  },
};

export const requestInterceptor = {
  install() {
    // 拦截 request 请求
    uni.addInterceptor('request', httpInterceptor);
    // 拦截 uploadFile 文件上传
    uni.addInterceptor('uploadFile', httpInterceptor);
  },
};

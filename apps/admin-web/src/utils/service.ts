import json5 from 'json5';

/**
 * Create service config by current env
 *
 * @param env The current env
 */
export function createServiceConfig(env: Env.ImportMeta) {
  const { VITE_SERVICE_BASE_URL, VITE_OTHER_SERVICE_BASE_URL, VITE_APP_BASE_API, VITE_APP_WEBSOCKET } = env;

  let other = {} as Record<App.Service.OtherBaseURLKey, string>;
  try {
    if (VITE_OTHER_SERVICE_BASE_URL) {
      other = json5.parse(VITE_OTHER_SERVICE_BASE_URL);
    }
  } catch {
    // eslint-disable-next-line no-console
    console.error('VITE_OTHER_SERVICE_BASE_URL is not a valid json5 string');
  }

  const httpConfig: App.Service.SimpleServiceConfig = {
    baseURL: VITE_SERVICE_BASE_URL,
    other,
  };

  const otherHttpKeys = Object.keys(httpConfig.other) as App.Service.OtherBaseURLKey[];

  const otherConfig: App.Service.OtherServiceConfigItem[] = otherHttpKeys.map((key) => {
    return {
      key,
      ws: false,
      baseURL: httpConfig.other[key],
      proxyPattern: createProxyPattern(key),
    };
  });

  const config: App.Service.ServiceConfig = {
    baseURL: httpConfig.baseURL,
    ws: VITE_APP_WEBSOCKET === 'Y',
    proxyPattern: VITE_APP_BASE_API,
    other: otherConfig,
  };

  return config;
}

/**
 * get backend service base url
 *
 * @param env - the current env
 * @param isProxy - if use proxy
 */
export function getServiceBaseURL(env: Env.ImportMeta, isProxy: boolean = env.DEV && env.VITE_HTTP_PROXY === 'Y') {
  const { baseURL, other, proxyPattern } = createServiceConfig(env);

  const otherBaseURL = {} as Record<App.Service.OtherBaseURLKey, string>;

  other.forEach((item) => {
    otherBaseURL[item.key] = isProxy ? item.proxyPattern : item.baseURL;
  });

  return {
    baseURL: isProxy ? proxyPattern : (baseURL || '') + proxyPattern,
    otherBaseURL,
  };
}

/**
 * Get proxy pattern of backend service base url
 *
 * @param key If not set, will use the default key
 */
function createProxyPattern(key: App.Service.OtherBaseURLKey) {
  return `/proxy-${key}`;
}

/** dev 是否经 Vite 代理访问后端（与 request 层 isHttpProxy 一致） */
export function isDevHttpProxy(env: Env.ImportMeta = import.meta.env) {
  return Boolean(env.DEV && env.VITE_HTTP_PROXY === 'Y');
}

/**
 * 长连接 / SSE 等资源路径：代理模式下走页面同源 /api；直连模式下用完整后端 baseURL。
 */
export function resolveApiResourceUrl(path: string, env: Env.ImportMeta = import.meta.env) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (isDevHttpProxy(env)) {
    const prefix = env.VITE_APP_BASE_API || '/api';
    return `${window.location.origin}${prefix}${normalizedPath}`;
  }

  const { baseURL } = getServiceBaseURL(env, false);
  const root = baseURL.replace(/\/$/, '');
  return `${root}${normalizedPath}`;
}

/** WebSocket 地址（http(s) base → ws(s)） */
export function resolveWebSocketResourceUrl(path: string, env: Env.ImportMeta = import.meta.env) {
  const httpUrl = resolveApiResourceUrl(path, env);
  return httpUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
}

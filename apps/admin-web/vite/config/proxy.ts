import type { ServerResponse } from 'node:http';
import type { ProxyOptions } from 'vite';
import { bgRed, bgYellow, green, lightBlue } from 'kolorist';
import { consola } from 'consola';
import { createServiceConfig } from '../../src/utils/service';

/** SSE 经 Vite 代理时，后端重启或热更新会导致对端断开，属预期情况 */
function isBenignSseProxyDisconnect(err: Error, requestUrl: string): boolean {
  if (!requestUrl.includes('/resource/sse')) return false;
  const code =
    'code' in err && typeof (err as NodeJS.ErrnoException).code === 'string'
      ? (err as NodeJS.ErrnoException).code
      : undefined;
  return code === 'ECONNRESET' || code === 'EPIPE' || code === 'ECONNREFUSED';
}

function tryCloseProxiedClientResponse(res: unknown): void {
  if (!res || typeof res !== 'object' || !('headersSent' in res)) return;
  const r = res as ServerResponse;
  try {
    if (r.headersSent) r.destroy();
    else r.end();
  } catch {
    /* 对端已关闭时忽略 */
  }
}

/**
 * Set http proxy
 *
 * @param env - The current env
 * @param enable - If enable http proxy
 */
export function createViteProxy(env: Env.ImportMeta, enable: boolean) {
  const isEnableHttpProxy = enable && env.VITE_HTTP_PROXY === 'Y';

  if (!isEnableHttpProxy) return undefined;

  const isEnableProxyLog = env.VITE_PROXY_LOG === 'Y';

  const { baseURL, proxyPattern, ws, other } = createServiceConfig(env);

  const proxy: Record<string, ProxyOptions> = createProxyItem({ baseURL, ws, proxyPattern }, isEnableProxyLog);

  other.forEach((item) => {
    Object.assign(proxy, createProxyItem(item, isEnableProxyLog));
  });

  return proxy;
}

function createProxyItem(item: App.Service.ServiceConfigItem, enableLog: boolean) {
  const proxy: Record<string, ProxyOptions> = {};

  proxy[item.proxyPattern] = {
    target: item.baseURL,
    changeOrigin: true,
    ws: item.ws,
    // 长连接（如 /resource/sse）：避免开发代理默认超时导致 read ECONNRESET
    timeout: 0,
    proxyTimeout: 0,
    configure: (_proxy, options) => {
      _proxy.on('proxyReq', (_proxyReq, req, _res) => {
        if (!enableLog) return;

        const requestUrl = `${lightBlue('[proxy url]')}: ${bgYellow(` ${req.method} `)} ${green(req.url || '')}`;

        const proxyUrl = `${lightBlue('[real request url]')}: ${green(`${options.target}${req.url}`)}`;

        consola.log(`\n${requestUrl}\n${proxyUrl}`);
      });
      _proxy.on('error', (err: Error, req, res) => {
        const url = req.url ?? '';
        if (isBenignSseProxyDisconnect(err, url)) {
          tryCloseProxiedClientResponse(res);
          return;
        }
        if (!enableLog) return;
        consola.log(bgRed(`Error: ${req.method} `), green(`${options.target}${req.url}`));
      });
    },
    // 不再移除 proxyPattern 前缀，保留 /api 让后端接收
    // rewrite: path => path.replace(new RegExp(`^${item.proxyPattern}`), '')
  };

  return proxy;
}

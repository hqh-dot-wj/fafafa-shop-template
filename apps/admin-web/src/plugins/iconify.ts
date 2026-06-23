import { addAPIProvider } from '@iconify/vue';

/**
 * 显式注册 iconify API provider：
 *
 * - 优先用 `VITE_ICONIFY_URL`（用户可在 .env 里指向自建反代 / 国内镜像）
 * - 缺省回退用官方 + jsdelivr 两个源做 fallback。iconify 客户端会并发探测最快的资源，
 *   单点超时不会阻塞菜单图标渲染。
 *
 * 旧实现里 `VITE_ICONIFY_URL` 未配置时根本不调用 `addAPIProvider`，导致每个动态 `<Icon>`
 * 在首次出现时走库内部 lazy init 路径，国内网络下偶发整批图标等待 5–10 秒。
 */
export function setupIconifyOffline() {
  const { VITE_ICONIFY_URL } = import.meta.env;

  const resources = VITE_ICONIFY_URL
    ? [VITE_ICONIFY_URL]
    : ['https://api.iconify.design', 'https://api.simplesvg.com', 'https://api.unisvg.com'];

  addAPIProvider('', { resources });
}

/**
 * 过滤无效或占位外链，避免 NAvatar/NImage 对不可达地址发起请求（如种子数据 `http://a.com/...`）。
 */
export function safeRemoteImageUrl(url: string | null | undefined): string | undefined {
  if (url === null || url === undefined || typeof url !== 'string') {
    return undefined;
  }
  const t = url.trim();
  if (!t) {
    return undefined;
  }
  if (/^https?:\/\/a\.com(\/|$)/i.test(t)) {
    return undefined;
  }
  return t;
}

/**
 * 管理端 OSS 列表展示用：本地相对路径拼成可访问绝对 URL
 */
export function resolveUploadPublicUrl(url: string, fileDomain: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const base = fileDomain.replace(/\/+$/u, '');
  const p = url.startsWith('/') ? url : `/${url}`;
  return `${base}${p}`;
}

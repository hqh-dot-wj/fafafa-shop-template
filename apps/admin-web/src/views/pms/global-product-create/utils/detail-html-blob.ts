/** 商品详情 HTML 中是否仍包含浏览器临时 blob 地址（提交后无法访问） */
export function detailHtmlContainsBlobUrl(html: string): boolean {
  if (!html || html.length < 8) {
    return false;
  }
  return /\bsrc\s*=\s*["']blob:/i.test(html) || /blob:https?:\/\//i.test(html);
}

import MarkdownIt from 'markdown-it';

/**
 * 单例：AI 正文 Markdown → 小程序 rich-text 可用的 HTML（关闭 raw HTML，避免注入）
 */
const md = new MarkdownIt({
  html: false,
  linkify: false,
  breaks: true,
});

/**
 * 将 Markdown 转为 `rich-text` 的 `nodes` 字符串（uni-app / 微信基础库 2.24+）
 * 纯文本也会被包成段落，保留换行与列表等版式。
 */
export function markdownToRichHtml(source: string): string {
  const s = source?.trim() ?? '';
  if (!s) return '';
  return md.render(s);
}

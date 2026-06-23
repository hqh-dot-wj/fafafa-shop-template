/**
 * 拼课/开课时间展示：固定东八区，避免 H5 本地时区把 +08:00 偏移成前一天。
 */
export function formatClassDateTimeText(value: unknown): string {
  if (value == null || value === '') return '';
  const raw = String(value).trim();
  if (!raw) return '';

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';

  try {
    const parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(parsed);

    const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';

    const y = pick('year');
    const m = pick('month');
    const d = pick('day');
    const hh = pick('hour');
    const mm = pick('minute');
    if (!y || !m || !d) return '';
    return `${y}-${m}-${d} ${hh || '00'}:${mm || '00'}`;
  } catch {
    const y = parsed.getUTCFullYear();
    const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const d = String(parsed.getUTCDate()).padStart(2, '0');
    const hh = String(parsed.getUTCHours()).padStart(2, '0');
    const mm = String(parsed.getUTCMinutes()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}`;
  }
}

/** 列表大卡 footer 用短格式：7月5日 10:00（东八区） */
export function formatClassDateTimeShort(value: unknown): string {
  const full = formatClassDateTimeText(value);
  if (!full) return '';
  const match = /^\d{4}-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(full);
  if (!match) return full;
  const month = Number(match[1]);
  const day = Number(match[2]);
  return `${month}月${day}日 ${match[3]}:${match[4]}`;
}

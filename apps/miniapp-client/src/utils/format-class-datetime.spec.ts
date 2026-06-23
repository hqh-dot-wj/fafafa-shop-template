import { describe, expect, it } from 'vitest';

import { formatClassDateTimeText } from './format-class-datetime';

describe('formatClassDateTimeText', () => {
  it('按东八区格式化带 offset 的 ISO', () => {
    expect(formatClassDateTimeText('2026-07-05T10:00:00+08:00')).toBe('2026-07-05 10:00');
  });

  it('空值返回空串', () => {
    expect(formatClassDateTimeText('')).toBe('');
    expect(formatClassDateTimeText(null)).toBe('');
  });
});

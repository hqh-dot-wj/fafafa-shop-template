import { parseMemberAvatarDataUrl } from './member-avatar-data-url';

/** 1x1 PNG */
const PNG_1X1_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('parseMemberAvatarDataUrl', () => {
  it('合法 PNG data URL 应解析成功', () => {
    const raw = `data:image/png;base64,${PNG_1X1_B64}`;
    const r = parseMemberAvatarDataUrl(raw);
    expect(r).not.toBeNull();
    expect(r?.mimeType).toBe('image/png');
    expect(r?.fileName).toBe('member-avatar.png');
    expect(r?.buffer.length).toBeGreaterThan(10);
  });

  it('无前缀或非 data URL 应返回 null', () => {
    expect(parseMemberAvatarDataUrl(PNG_1X1_B64)).toBeNull();
    expect(parseMemberAvatarDataUrl('data:text/plain;base64,AA==')).toBeNull();
  });

  it('魔数不匹配的 PNG 应返回 null', () => {
    const fake = Buffer.from('xxxx', 'utf8').toString('base64');
    expect(parseMemberAvatarDataUrl(`data:image/png;base64,${fake}`)).toBeNull();
  });
});

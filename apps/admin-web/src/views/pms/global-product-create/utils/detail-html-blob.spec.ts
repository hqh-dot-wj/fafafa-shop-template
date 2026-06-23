import { describe, expect, it } from 'vitest';
import { detailHtmlContainsBlobUrl } from './detail-html-blob';

describe('detailHtmlContainsBlobUrl', () => {
  it('识别 img 上 blob src', () => {
    expect(detailHtmlContainsBlobUrl('<img src="blob:http://localhost:9527/abc">')).toBe(true);
  });

  it('OSS 地址为 false', () => {
    expect(
      detailHtmlContainsBlobUrl(
        '<img src="https://nest-admin.oss-cn-beijing.aliyuncs.com/a.jpg">',
      ),
    ).toBe(false);
  });

  it('空串为 false', () => {
    expect(detailHtmlContainsBlobUrl('')).toBe(false);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { request } from '@/service/request';
import { fetchUploadFile, normalizeOssIdsForBatch } from './oss';

vi.mock('@/service/request', () => ({
  request: vi.fn(),
}));

describe('fetchUploadFile', () => {
  it('关闭防重复提交，避免批量 FormData 被误判为同一请求', async () => {
    vi.mocked(request).mockResolvedValue({
      data: { ossId: '1', url: 'https://example.com/f.png' } as Api.System.Oss,
      error: null,
    });
    await fetchUploadFile(new File(['x'], 'a.png', { type: 'image/png' }));
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ repeatSubmit: false }),
      }),
    );
  });
});

describe('normalizeOssIdsForBatch', () => {
  it('过滤空串与空白，并转字符串', () => {
    expect(normalizeOssIdsForBatch(['1', '  ', '', '2'])).toEqual(['1', '2']);
  });

  it('忽略 undefined/null', () => {
    expect(normalizeOssIdsForBatch([undefined as unknown as string, null as unknown as string, '10'])).toEqual(['10']);
  });

  it('全部无效时为空数组', () => {
    expect(normalizeOssIdsForBatch(['', '   '])).toEqual([]);
  });
});

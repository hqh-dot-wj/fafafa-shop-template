import { resolveUploadPublicUrl } from './oss-display-url';

describe('resolveUploadPublicUrl', () => {
  it('已是 http(s) 时原样返回', () => {
    expect(resolveUploadPublicUrl('https://bucket.oss-cn-beijing.aliyuncs.com/a.png', 'http://localhost:8080')).toBe(
      'https://bucket.oss-cn-beijing.aliyuncs.com/a.png',
    );
  });

  it('相对路径与 file.domain 拼接', () => {
    expect(resolveUploadPublicUrl('/profile/2026/04/13/x.png', 'http://localhost:8080')).toBe(
      'http://localhost:8080/profile/2026/04/13/x.png',
    );
  });
});

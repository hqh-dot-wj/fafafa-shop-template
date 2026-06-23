import { appendAliyunOssPutDeniedGuidance } from './oss-put-error-hint';

describe('appendAliyunOssPutDeniedGuidance', () => {
  it('bucket acl 类英文报错应附加 RAM 与地域核对说明', () => {
    const raw = 'You have no right to access this object because of bucket acl.';
    const out = appendAliyunOssPutDeniedGuidance(raw);
    expect(out).toContain(raw);
    expect(out).toContain('oss:PutObject');
    expect(out).toContain('OSS_REGION');
    expect(out).toContain('Bucket Policy');
  });

  it('其它错误原样返回', () => {
    expect(appendAliyunOssPutDeniedGuidance('Network timeout')).toBe('Network timeout');
  });
});

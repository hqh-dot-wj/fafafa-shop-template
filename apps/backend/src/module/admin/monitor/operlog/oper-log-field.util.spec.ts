import { clipSysOperLogVarchar, SYS_OPER_LOG_VARCHAR_MAX } from './oper-log-field.util';

describe('clipSysOperLogVarchar', () => {
  it('短于上限原样返回', () => {
    expect(clipSysOperLogVarchar('ok')).toBe('ok');
  });

  it('超长截断并带标记', () => {
    const raw = 'x'.repeat(SYS_OPER_LOG_VARCHAR_MAX + 100);
    const out = clipSysOperLogVarchar(raw);
    expect(out.length).toBeLessThanOrEqual(SYS_OPER_LOG_VARCHAR_MAX);
    expect(out.endsWith('...[truncated]')).toBe(true);
  });
});

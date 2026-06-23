import { describe, expect, it } from 'vitest';

import { getMemberPhone, hasBoundPhone } from './member-phone';

describe('member-phone', () => {
  it('优先使用 mobile', () => {
    expect(getMemberPhone({ mobile: '13800138000', phone: '13900139000' })).toBe('13800138000');
  });

  it('兼容仅有 phone 的旧缓存', () => {
    expect(getMemberPhone({ phone: '13800138000' })).toBe('13800138000');
  });

  it('空值视为未绑定', () => {
    expect(hasBoundPhone({ mobile: null, phone: '' })).toBe(false);
    expect(hasBoundPhone(undefined)).toBe(false);
  });

  it('h5 密码登录后 mobile 有值即视为已绑定', () => {
    expect(hasBoundPhone({ mobile: '13800138000' })).toBe(true);
  });
});

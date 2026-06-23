import * as crypto from 'crypto';
import { buildRateLimitIdentityKey, resolveRateLimitIp, resolveRateLimitTenantId } from './rate-limit-key.util';

describe('rate-limit-key.util', () => {
  it('Given tenant and userId, When build identity key, Then should use user dimension', () => {
    const key = buildRateLimitIdentityKey(
      {
        headers: { 'tenant-id': '100001' },
        user: { userId: 'member-100' },
        ip: '10.0.0.1',
      },
      'product-list',
    );

    expect(key).toBe('product-list:tenant:100001:user:member-100');
  });

  it('Given bearer token without userId, When build identity key, Then should use token digest', () => {
    const token = 'mock-token-abcdefghijklmnopqrstuvwxyz';
    const expectedDigest = crypto.createHash('md5').update(token).digest('hex').slice(0, 16);

    const key = buildRateLimitIdentityKey(
      {
        headers: {
          'tenant-id': '100001',
          authorization: `Bearer ${token}`,
        },
        ip: '10.0.0.1',
      },
      'product-list',
    );

    expect(key).toBe(`product-list:tenant:100001:token:${expectedDigest}`);
    expect(key.includes(token)).toBe(false);
  });

  it('Given no tenant and no token, When resolve identity, Then should fallback to super tenant + first forwarded ip', () => {
    const tenantId = resolveRateLimitTenantId({
      headers: {},
      query: {},
    });
    const ip = resolveRateLimitIp({
      headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' },
      ip: '10.0.0.2',
    });
    const key = buildRateLimitIdentityKey(
      {
        headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' },
      },
      'global-http',
    );

    expect(tenantId).toBe('000000');
    expect(ip).toBe('203.0.113.1');
    expect(key).toBe('global-http:tenant:000000:ip:203.0.113.1');
  });
});

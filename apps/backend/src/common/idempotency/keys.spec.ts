import { buildIdempotencyKey, redisIdempotencyKey } from './keys';

describe('Idempotency keys', () => {
  it('builds a canonical key with domain, action, entity and optional sub id', () => {
    expect(buildIdempotencyKey('order', 'paid', 'order-001')).toBe('order:paid:order-001');
    expect(buildIdempotencyKey('order', 'refunded', 'order-001', 'refund-001')).toBe(
      'order:refunded:order-001:refund-001',
    );
  });

  it('adds the Redis namespace without changing the canonical key', () => {
    const key = buildIdempotencyKey('commission', 'trigger', 'order-001');

    expect(redisIdempotencyKey(key)).toBe('mkt:idem:commission:trigger:order-001');
  });

  it('rejects separators inside action, entity id or sub id', () => {
    expect(() => buildIdempotencyKey('order', 'pa:id', 'order-001')).toThrow(/cannot contain/);
    expect(() => buildIdempotencyKey('order', 'paid', 'order:001')).toThrow(/cannot contain/);
    expect(() => buildIdempotencyKey('order', 'refunded', 'order-001', 'refund:001')).toThrow(/cannot contain/);
  });

  it('rejects keys longer than 160 characters', () => {
    expect(() => buildIdempotencyKey('order', 'paid', 'o'.repeat(160))).toThrow(/too long/);
  });
});

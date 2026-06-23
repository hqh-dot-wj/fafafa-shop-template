export type IdempotencyDomain = 'order' | 'coupon' | 'points' | 'play' | 'commission' | 'share';

export type IdempotencyKey = string & { readonly __brand: 'IdempotencyKey' };

const MAX_IDEMPOTENCY_KEY_LENGTH = 160;
const RESERVED_SEPARATOR = ':';

function assertSegment(name: string, value: string): void {
  if (!value) {
    throw new Error(`${name} cannot be empty`);
  }
  if (value.includes(RESERVED_SEPARATOR)) {
    throw new Error(`${name} cannot contain '${RESERVED_SEPARATOR}': ${value}`);
  }
}

export function buildIdempotencyKey(
  domain: IdempotencyDomain,
  action: string,
  entityId: string,
  subId?: string,
): IdempotencyKey {
  assertSegment('action', action);
  assertSegment('entityId', entityId);
  if (subId !== undefined) {
    assertSegment('subId', subId);
  }

  const full = [domain, action, entityId, subId].filter((part): part is string => part !== undefined).join(':');
  if (full.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw new Error(`Idempotency key too long: ${full.length}`);
  }

  return full as IdempotencyKey;
}

export function redisIdempotencyKey(key: IdempotencyKey): string {
  return `mkt:idem:${key}`;
}

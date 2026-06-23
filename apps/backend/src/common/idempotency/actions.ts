export const IdempotencyActions = {
  order: {
    created: 'created',
    paid: 'paid',
    cancelled: 'cancelled',
    refunded: 'refunded',
  },
  coupon: {
    claimed: 'claimed',
    used: 'used',
    claimLock: 'claimLock',
  },
  points: {
    earn: 'earn',
    deduct: 'deduct',
    freeze: 'freeze',
    settle: 'settle',
    refund: 'refund',
    expire: 'expire',
  },
  play: {
    lockToken: 'lockToken',
  },
  commission: {
    trigger: 'trigger',
    applyOrderCount: 'applyOrderCount',
  },
  share: {
    orderAttributed: 'orderAttributed',
    refundReversed: 'refundReversed',
    disableShareUser: 'disableShareUser',
  },
} as const;

type NestedValue<T> = T[keyof T] extends infer V ? (V extends Record<string, string> ? V[keyof V] : never) : never;

export type IdempotencyAction = NestedValue<typeof IdempotencyActions>;

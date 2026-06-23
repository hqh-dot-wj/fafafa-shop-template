import {
  CURRENT_POINTS_ASSET_LEDGER_CAPABILITY,
  resolvePointsRefundLedgerDecision,
} from './points-asset-ledger.policy';

describe('PointsAssetLedgerPolicy', () => {
  it('states that current points ledger is lot/allocation capable', () => {
    expect(CURRENT_POINTS_ASSET_LEDGER_CAPABILITY).toEqual({
      mode: 'LOT_ALLOCATION',
      supportsLot: true,
      supportsConsumeAllocation: true,
      supportsFreezeAllocation: true,
      supportsOriginalRefund: true,
    });
  });

  it('uses new refund transaction only for historical spends without allocation', () => {
    const decision = resolvePointsRefundLedgerDecision({ pointsUsed: 120, hasLotAllocation: false });

    expect(decision).toEqual({
      strategy: 'NEW_REFUND_TRANSACTION',
      transactionRemark: '订单退款返还',
      requiresLotAllocation: false,
      residualRisk: expect.stringContaining('历史消费缺少分摊记录'),
    });
  });

  it('supports original lot restore by default after allocation capability is enabled', () => {
    const decision = resolvePointsRefundLedgerDecision({ pointsUsed: 120 });

    expect(decision).toEqual({
      strategy: 'ORIGINAL_LOT_RESTORE',
      transactionRemark: '订单退款原路返还',
      requiresLotAllocation: true,
      residualRisk: null,
    });
  });

  it('routes expired source lots to compensation policy instead of pretending original restore is safe', () => {
    const decision = resolvePointsRefundLedgerDecision({
      pointsUsed: 120,
      hasLotAllocation: true,
      originalLotExpired: true,
    });

    expect(decision.strategy).toBe('EXPIRED_LOT_COMPENSATION');
    expect(decision.residualRisk).toContain('原消费 lot 已过期');
  });
});

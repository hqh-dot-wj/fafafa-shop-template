export type PointsAssetLedgerMode = 'BALANCE_TRANSACTION' | 'LOT_ALLOCATION';

export type PointsRefundReturnStrategy =
  | 'NO_POINTS'
  | 'NEW_REFUND_TRANSACTION'
  | 'ORIGINAL_LOT_RESTORE'
  | 'EXPIRED_LOT_COMPENSATION'
  | 'MANUAL_REVIEW';

export interface PointsAssetLedgerCapability {
  mode: PointsAssetLedgerMode;
  supportsLot: boolean;
  supportsConsumeAllocation: boolean;
  supportsFreezeAllocation: boolean;
  supportsOriginalRefund: boolean;
}

export interface ResolvePointsRefundLedgerDecisionInput {
  pointsUsed: number;
  hasLotAllocation?: boolean;
  originalLotExpired?: boolean;
  partialRefund?: boolean;
}

export interface PointsRefundLedgerDecision {
  strategy: PointsRefundReturnStrategy;
  transactionRemark: string;
  requiresLotAllocation: boolean;
  residualRisk: string | null;
}

export const CURRENT_POINTS_ASSET_LEDGER_CAPABILITY: PointsAssetLedgerCapability = {
  mode: 'LOT_ALLOCATION',
  supportsLot: true,
  supportsConsumeAllocation: true,
  supportsFreezeAllocation: true,
  supportsOriginalRefund: true,
};

/**
 * 积分账已经具备 lot/allocation 能力。新订单退款优先恢复原消费 lot；历史订单缺少消费分摊时，
 * 仍会降级为 REFUND 补偿批次，因此调用方需要记录策略以便排障。
 */
export function resolvePointsRefundLedgerDecision(
  input: ResolvePointsRefundLedgerDecisionInput,
): PointsRefundLedgerDecision {
  if (input.pointsUsed <= 0) {
    return {
      strategy: 'NO_POINTS',
      transactionRemark: '订单未使用积分，无需返还',
      requiresLotAllocation: false,
      residualRisk: null,
    };
  }

  if (input.hasLotAllocation === false) {
    return {
      strategy: 'NEW_REFUND_TRANSACTION',
      transactionRemark: '订单退款返还',
      requiresLotAllocation: false,
      residualRisk: '该笔历史消费缺少分摊记录，退款返还是新 REFUND 补偿批次，无法恢复到原来源批次。',
    };
  }

  if (input.originalLotExpired) {
    return {
      strategy: 'EXPIRED_LOT_COMPENSATION',
      transactionRemark: '订单退款积分补偿',
      requiresLotAllocation: true,
      residualRisk: '原消费 lot 已过期，需要按业务政策决定宽限期、补偿批次或人工复核。',
    };
  }

  if (input.partialRefund) {
    return {
      strategy: 'ORIGINAL_LOT_RESTORE',
      transactionRemark: '订单部分退款原路返还',
      requiresLotAllocation: true,
      residualRisk: null,
    };
  }

  return {
    strategy: 'ORIGINAL_LOT_RESTORE',
    transactionRemark: '订单退款原路返还',
    requiresLotAllocation: true,
    residualRisk: null,
  };
}

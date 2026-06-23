type LabelMap = Record<string, string>;

function toOptions<T extends string>(labelMap: Record<T, string>) {
  return Object.entries(labelMap).map(([value, label]) => ({
    label,
    value,
  })) as Array<{ label: string; value: T }>;
}

/** 分销设置：佣金计算基数 */
const commissionBaseTypeLabelMap: LabelMap = {
  ORIGINAL_PRICE: '原价',
  ACTUAL_PAID: '实付',
  ZERO: '不分佣',
};

export const distributionCommissionBaseTypeOptions = toOptions(
  commissionBaseTypeLabelMap as Record<'ORIGINAL_PRICE' | 'ACTUAL_PAID' | 'ZERO', string>,
);

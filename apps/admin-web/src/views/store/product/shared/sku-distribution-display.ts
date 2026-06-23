import { Money, type MoneyInput } from '@/utils/money';
import { $t } from '@/locales';

type SkuDistributionMode = Api.Pms.DistributionMode | string | null | undefined;

const modeMetaRecord = {
  NONE: {
    labelKey: 'page.pms.globalProductCreate.step3.distNone',
    tagType: 'default',
  },
  RATIO: {
    labelKey: 'page.pms.globalProductCreate.step3.distRatio',
    tagType: 'success',
  },
  FIXED: {
    labelKey: 'page.pms.globalProductCreate.step3.distFixed',
    tagType: 'info',
  },
} as const;

function normalizeSkuDistributionMode(mode: SkuDistributionMode): keyof typeof modeMetaRecord | null {
  if (mode === 'NONE' || mode === 'RATIO' || mode === 'FIXED') return mode;
  return null;
}

export function getSkuDistributionModeMeta(mode: SkuDistributionMode) {
  const normalizedMode = normalizeSkuDistributionMode(mode);
  if (!normalizedMode) {
    return {
      label: mode ? String(mode) : '-',
      tagType: 'default' as const,
    };
  }

  const meta = modeMetaRecord[normalizedMode];
  return {
    label: $t(meta.labelKey),
    tagType: meta.tagType,
  };
}

export function getSkuDistributionRateSuffix(mode: SkuDistributionMode) {
  return normalizeSkuDistributionMode(mode) === 'FIXED' ? $t('page.pms.globalProductCreate.step3.suffixYuan') : '';
}

export function getSkuDistributionRatePrecision(mode: SkuDistributionMode) {
  return normalizeSkuDistributionMode(mode) === 'RATIO' ? 4 : 2;
}

export function canEditSkuDistributionRate(mode: SkuDistributionMode) {
  return normalizeSkuDistributionMode(mode) !== 'NONE';
}

/**
 * SKU 分佣配置只决定订单佣金池：NONE 不参与，RATIO 按售价比例，FIXED 按固定金额。
 */
export function calculateSkuDistributionCommission(price: MoneyInput, distRate: MoneyInput, mode: SkuDistributionMode) {
  const normalizedMode = normalizeSkuDistributionMode(mode);
  if (normalizedMode === 'NONE') return new Money(0);
  if (normalizedMode === 'RATIO') return new Money(price).mul(distRate);
  if (normalizedMode === 'FIXED') return new Money(distRate);
  return new Money(0);
}

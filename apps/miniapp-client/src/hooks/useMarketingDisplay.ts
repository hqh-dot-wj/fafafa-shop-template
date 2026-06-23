import type { Ref } from 'vue';
import type { ActivityKind } from '@/components/marketing-card/marketing-card.types';
import { computed } from 'vue';
import { resolveActivityKind } from '@/components/marketing-card/marketing-card.mapper';
import { getCtaPreset } from '@/components/marketing-card/marketing-cta-map';
import { isCourseGroupActivityType } from '@/constants/course-group';

interface MarketingView {
  primaryOffer?: Record<string, unknown> | null;
  priceView?: {
    salePrice?: number;
    originalPrice?: number | null;
  } | null;
  commissionView?: {
    previewText?: string;
  } | null;
}

interface ProductWithActivity {
  price?: number;
  skus?: Array<{ skuId: string; price?: number }>;
  mainActivity?: Record<string, unknown> | null;
  mainActivitySummary?: Record<string, unknown> | null;
  marketingView?: MarketingView | null;
}

interface SkuInfo {
  skuId: string;
  price: number;
}

interface ActivityLike {
  activityContextKey: string;
  activityType: string;
  configId: string;
  activityName: string;
  displayPrice: number | null;
  originalPrice: number | null;
  [key: string]: unknown;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeActivityType(type: unknown): string {
  return String(type || '')
    .trim()
    .toUpperCase();
}

/** 门店货架价与活动原价接近时视为同一 SKU（应对 globalSkuId / tenantSkuId 键不一致） */
function isShelfPriceNearActivityOriginal(shelfPrice: number, activityOriginal: number): boolean {
  if (!Number.isFinite(shelfPrice) || !Number.isFinite(activityOriginal) || activityOriginal <= 0) {
    return false;
  }
  return Math.abs(shelfPrice - activityOriginal) / activityOriginal <= 0.15;
}

function pickSkuPriceEntry(
  skuPricesMap: Record<string, unknown>,
  skuId: string,
  skus: Array<{ skuId: string; price?: number }> | undefined,
): Record<string, unknown> {
  const direct = toRecord(skuPricesMap[skuId]);
  if (
    readNumber(direct.flashPrice) != null ||
    readNumber(direct.price) != null ||
    readNumber(direct.activityPrice) != null
  ) {
    return direct;
  }

  for (const [key, raw] of Object.entries(skuPricesMap)) {
    if (key === skuId || skuId.includes(key) || key.includes(skuId)) {
      const matched = toRecord(raw);
      if (
        readNumber(matched.flashPrice) != null ||
        readNumber(matched.price) != null ||
        readNumber(matched.activityPrice) != null
      ) {
        return matched;
      }
    }
  }

  const keys = Object.keys(skuPricesMap);
  if (keys.length === 1 && skus?.length) {
    const onlyKey = keys[0]!;
    const onlyEntry = toRecord(skuPricesMap[onlyKey]);
    const matchedSku =
      skus.find((s) => s.skuId === onlyKey || s.skuId.includes(onlyKey) || onlyKey.includes(s.skuId)) ?? skus[0];
    if (matchedSku?.skuId === skuId) {
      return onlyEntry;
    }
  }

  return {};
}

export function useMarketingDisplay(product: Ref<ProductWithActivity | null>, selectedSku: Ref<SkuInfo | null>) {
  const activeActivity = computed<ActivityLike | null>(() => {
    const mainActivity = toRecord(product.value?.mainActivity);
    const mainActivitySummary = toRecord(product.value?.mainActivitySummary);
    const primaryOffer = toRecord(product.value?.marketingView?.primaryOffer);

    const source = readString(mainActivity.activityContextKey)
      ? mainActivity
      : readString(mainActivitySummary.activityContextKey)
        ? mainActivitySummary
        : primaryOffer;
    const activityContextKey = readString(source.activityContextKey);
    if (!activityContextKey) return null;

    return {
      ...source,
      activityContextKey,
      activityType: normalizeActivityType(readString(source.activityType) ?? 'UNKNOWN'),
      configId: readString(source.configId) ?? '',
      activityName: readString(source.activityName) ?? '',
      displayPrice: readNumber(source.displayPrice) ?? readNumber(source.activityPrice),
      originalPrice: readNumber(source.originalPrice),
    };
  });

  const activityKind = computed<ActivityKind>(() => {
    if (!activeActivity.value) return 'normal';
    return resolveActivityKind(activeActivity.value.activityType);
  });

  const skuActivityBadgeText = computed(() => getCtaPreset(activityKind.value).badgeText);

  function resolveSkuActivityPrices(skuId: string | undefined): {
    flashPrice: number | null;
    originalPrice: number | null;
  } {
    if (!activeActivity.value || !skuId) return { flashPrice: null, originalPrice: null };

    const rules = toRecord(activeActivity.value.rules);
    const skuPricesMap = toRecord(rules.skuPrices);
    const mapKeys = Object.keys(skuPricesMap);
    const shelfPrice =
      selectedSku.value?.skuId === skuId
        ? selectedSku.value.price
        : product.value?.skus?.find((s) => s.skuId === skuId)?.price;

    if (mapKeys.length > 0) {
      const entry = pickSkuPriceEntry(skuPricesMap, skuId, product.value?.skus);
      const flashPrice = readNumber(entry.flashPrice) ?? readNumber(entry.price) ?? readNumber(entry.activityPrice);
      if (flashPrice != null) {
        return {
          flashPrice,
          originalPrice: readNumber(entry.originalPrice) ?? (typeof shelfPrice === 'number' ? shelfPrice : null),
        };
      }
    }

    const activityType = normalizeActivityType(activeActivity.value.activityType);
    const activityPrice =
      readNumber(activeActivity.value.displayPrice) ?? readNumber(activeActivity.value.activityPrice);
    const activityOriginal = readNumber(activeActivity.value.originalPrice);

    if (
      isCourseGroupActivityType(activityType) &&
      activityPrice != null &&
      activityOriginal != null &&
      typeof shelfPrice === 'number' &&
      isShelfPriceNearActivityOriginal(shelfPrice, activityOriginal)
    ) {
      return {
        flashPrice: activityPrice,
        originalPrice: activityOriginal,
      };
    }

    return { flashPrice: null, originalPrice: null };
  }

  function getSkuActivityPrice(skuId: string): number | null {
    return resolveSkuActivityPrices(skuId).flashPrice;
  }

  const hasSkuPriceMap = computed(() => {
    if (!activeActivity.value) return false;
    const rules = toRecord(activeActivity.value.rules);
    const sp = rules.skuPrices;
    return sp != null && typeof sp === 'object' && Object.keys(sp as object).length > 0;
  });

  const hasMultipleSkus = computed(() => (product.value?.skus?.length ?? 0) > 1);

  /** 无 skuPrices 时仅单规格商品按整品活动价展示；多规格须逐 SKU 命中 map */
  const isProductWideActivity = computed(
    () => Boolean(activeActivity.value) && !hasSkuPriceMap.value && !hasMultipleSkus.value,
  );

  const selectedSkuInActivity = computed(() => {
    if (!activeActivity.value) return false;
    if (resolveSkuActivityPrices(selectedSku.value?.skuId).flashPrice != null) return true;
    return isProductWideActivity.value;
  });

  const displayPrice = computed(() => {
    const skuPrice = resolveSkuActivityPrices(selectedSku.value?.skuId);
    if (skuPrice.flashPrice != null) return skuPrice.flashPrice;
    if (hasSkuPriceMap.value) {
      return selectedSku.value?.price ?? product.value?.price ?? 0;
    }
    if (isProductWideActivity.value) {
      if (activeActivity.value?.displayPrice != null) {
        return activeActivity.value.displayPrice;
      }
      if (product.value?.marketingView?.priceView?.salePrice != null) {
        return product.value.marketingView.priceView.salePrice;
      }
    }
    if (selectedSku.value) {
      return selectedSku.value.price;
    }
    if (activeActivity.value?.displayPrice != null) {
      return activeActivity.value.displayPrice;
    }
    if (product.value?.marketingView?.priceView?.salePrice != null) {
      return product.value.marketingView.priceView.salePrice;
    }
    return product.value?.price ?? 0;
  });

  const originalPrice = computed(() => {
    if (!selectedSkuInActivity.value) return null;
    const skuPrice = resolveSkuActivityPrices(selectedSku.value?.skuId);
    if (skuPrice.originalPrice != null) return skuPrice.originalPrice;
    if (hasSkuPriceMap.value) return null;
    if (activeActivity.value?.originalPrice != null) {
      return activeActivity.value.originalPrice;
    }
    if (product.value?.marketingView?.priceView?.originalPrice != null) {
      return product.value.marketingView.priceView.originalPrice;
    }
    if (!activeActivity.value) return null;
    const normalPrice = selectedSku.value?.price ?? product.value?.price ?? 0;
    if (Number(displayPrice.value) === Number(normalPrice)) return null;
    return normalPrice;
  });

  const activityLabel = computed(() => {
    if (!activeActivity.value || !selectedSkuInActivity.value) return '售价';
    const preset = getCtaPreset(activityKind.value);
    if (preset.priceLabel) return preset.priceLabel;
    const activityType = normalizeActivityType(activeActivity.value.activityType);
    if (isCourseGroupActivityType(activityType)) return '拼课价';
    return '活动价';
  });

  const activityExplainItems = computed<string[]>(() => {
    if (!activeActivity.value || !selectedSkuInActivity.value) return [];
    const rules = toRecord(activeActivity.value.rules);
    const kind = activityKind.value;

    if (kind === 'flash') {
      const items: string[] = [];
      const stock =
        readNumber(activeActivity.value.remainingStock) ??
        readNumber(rules.remainingStock) ??
        readNumber(rules.totalStock);
      if (stock != null && stock > 0) items.push(`还剩${stock}份`);
      const limit = readNumber(rules.limitPerUser);
      if (limit != null && limit > 0) items.push(`每人限购${limit}份`);
      const endTime = readString(rules.endTime);
      if (endTime) items.push('优惠有时间限制，结束后恢复原价');
      return items;
    }

    if (kind === 'member') {
      const items = ['会员专享折扣价'];
      const level = readString(rules.memberLevel ?? rules.requiredLevel);
      if (level) items.push(`适用等级：${level}`);
      items.push('以结算页为准');
      return items;
    }

    const activityName = readString(activeActivity.value.activityName);
    return activityName ? [activityName] : [];
  });

  const commissionHint = computed(() => product.value?.marketingView?.commissionView?.previewText ?? '');

  return {
    activeActivity,
    activityKind,
    activityLabel,
    activityExplainItems,
    displayPrice,
    originalPrice,
    commissionHint,
    getSkuActivityPrice,
    selectedSkuInActivity,
    skuActivityBadgeText,
    hasSkuPriceMap,
    hasMultipleSkus,
    isProductWideActivity,
  };
}

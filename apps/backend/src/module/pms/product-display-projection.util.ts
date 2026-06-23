export type ProductDisplayTagCode = 'NEW' | 'STORE_RECOMMEND' | 'FREE_SHIPPING' | 'SERVICE_HOME';
export type ProductDisplayTagSource = 'RULE' | 'FACT' | 'MANUAL';
export type ProductPurchaseStatusCode = 'NORMAL' | 'BOOKING_REQUIRED';

export interface ProductDisplayTagProjection {
  code: ProductDisplayTagCode;
  label: string;
  source: ProductDisplayTagSource;
  priority: number;
}

export interface ProductPurchaseStatusProjection {
  code: ProductPurchaseStatusCode;
  label: string;
  purchasable: boolean;
}

export interface ProductServiceSummaryProjection {
  label: string;
  needBooking: boolean;
  serviceDuration?: number | null;
  serviceRadius?: number | null;
}

export interface ProductDisplayProjection {
  displayTags: ProductDisplayTagProjection[];
  purchaseStatus: ProductPurchaseStatusProjection;
  serviceSummary?: ProductServiceSummaryProjection;
}

export interface ProductDisplayProjectionInput {
  productType?: unknown;
  isFreeShip?: unknown;
  needBooking?: unknown;
  serviceDuration?: unknown;
  serviceRadius?: unknown;
  tenantProductCreateTime?: unknown;
  tenantProductIsHot?: unknown;
  now?: Date;
}

const NEW_PRODUCT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_DISPLAY_TAGS = 3;

/**
 * 商品展示投影只描述商品事实/规则/运营标记，不参与营销主活动裁决或下单活动锁定。
 * NEW 当前按门店商品 createTime 计算；isHot 仅映射为 STORE_RECOMMEND，不映射为“爆品”。
 */
export function buildProductDisplayProjection(input: ProductDisplayProjectionInput): ProductDisplayProjection {
  const productType = readString(input.productType).toUpperCase();
  const isService = productType === 'SERVICE';
  const tags: ProductDisplayTagProjection[] = [];

  if (isNewTenantProduct(input.tenantProductCreateTime, input.now ?? new Date())) {
    tags.push({ code: 'NEW', label: '新品', source: 'RULE', priority: 100 });
  }
  if (readBoolean(input.tenantProductIsHot)) {
    tags.push({ code: 'STORE_RECOMMEND', label: '门店推荐', source: 'MANUAL', priority: 90 });
  }
  if (isService) {
    tags.push({ code: 'SERVICE_HOME', label: '服务商品', source: 'FACT', priority: 80 });
  }
  if (readBoolean(input.isFreeShip)) {
    tags.push({ code: 'FREE_SHIPPING', label: '包邮', source: 'FACT', priority: 70 });
  }

  const needBooking = isService && readBoolean(input.needBooking);
  return {
    displayTags: tags.sort((a, b) => b.priority - a.priority).slice(0, MAX_DISPLAY_TAGS),
    purchaseStatus: needBooking
      ? { code: 'BOOKING_REQUIRED', label: '需预约', purchasable: true }
      : { code: 'NORMAL', label: '可购买', purchasable: true },
    serviceSummary: isService
      ? {
          label: needBooking ? '服务商品，需预约' : '服务商品',
          needBooking,
          serviceDuration: readNumber(input.serviceDuration) ?? null,
          serviceRadius: readNumber(input.serviceRadius) ?? null,
        }
      : undefined,
  };
}

function isNewTenantProduct(value: unknown, now: Date): boolean {
  const createTime = readDate(value);
  if (!createTime) return false;
  const ageMs = now.getTime() - createTime.getTime();
  return ageMs >= 0 && ageMs <= NEW_PRODUCT_WINDOW_MS;
}

function readDate(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  return null;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function readBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'y' || normalized === 'yes';
  }
  return false;
}

export interface MemberPickerSelection {
  memberId: string;
  nickname?: string;
  mobile?: string;
  levelName?: string;
  avatar?: string;
  displayName: string;
}

export interface TenantPickerSelection {
  tenantId: string;
  companyName?: string;
  contactUserName?: string;
  contactPhone?: string;
  displayName: string;
}

export interface ProductPickerSelection {
  id: string;
  productId: string;
  skuId?: string;
  name: string;
  productName?: string;
  displayName: string;
  specLabel?: string;
  type?: string;
  price?: number | string;
  guidePrice?: number | string;
  mainImages?: string[];
  coverImage?: string;
  subTitle?: string;
  skus?: unknown[];
  globalSkus?: unknown[];
  specValues?: Record<string, unknown> | string;
}

export interface CouponTemplatePickerSelection {
  id: string;
  templateId: string;
  name: string;
  displayName: string;
  description?: string;
  type?: 'DISCOUNT' | 'PERCENTAGE' | 'EXCHANGE' | string;
  discountAmount?: number;
  discountPercent?: number;
  minOrderAmount?: number;
  status?: string;
  validDays?: number;
  startTime?: string | Date;
  endTime?: string | Date;
}

export interface PointsTaskPickerSelection {
  id: string;
  taskId: string;
  taskKey: string;
  taskName: string;
  displayName: string;
  taskDescription?: string | null;
  pointsReward?: number;
  isRepeatable?: boolean;
  maxCompletions?: number | null;
  isEnabled?: boolean;
}

type MemberLike = Partial<MemberPickerSelection> & {
  memberId?: string;
  nickname?: string;
  mobile?: string;
  levelName?: string;
  avatar?: string;
  displayName?: string;
};

type TenantLike = Omit<Partial<TenantPickerSelection>, 'tenantId'> & {
  tenantId?: string | number;
  companyName?: string;
  contactUserName?: string;
  contactPhone?: string;
  displayName?: string;
};

type ProductLike = Partial<ProductPickerSelection> & {
  id?: string;
  productId?: string;
  skuId?: string;
  name?: string;
  productName?: string;
  displayName?: string;
  specLabel?: string;
  type?: string;
  price?: number | string;
  guidePrice?: number | string;
  mainImages?: string[];
  coverImage?: string;
  subTitle?: string;
  skus?: unknown[];
  globalSkus?: unknown[];
  specValues?: Record<string, unknown> | string;
};

type CouponTemplateLike = Partial<CouponTemplatePickerSelection> & {
  id?: string | number;
  templateId?: string | number;
  name?: string;
  displayName?: string;
  description?: string;
  type?: 'DISCOUNT' | 'PERCENTAGE' | 'EXCHANGE' | string;
  discountAmount?: number;
  discountPercent?: number;
  value?: number;
  minOrderAmount?: number;
  minAmount?: number;
  status?: string;
  validDays?: number;
  startTime?: string | Date;
  endTime?: string | Date;
  validStartTime?: string | Date;
  validEndTime?: string | Date;
};

type PointsTaskLike = Partial<PointsTaskPickerSelection> & {
  id?: string | number;
  taskId?: string | number;
  taskKey?: string;
  taskName?: string;
  displayName?: string;
  taskDescription?: string | null;
  pointsReward?: number;
  isRepeatable?: boolean;
  maxCompletions?: number | null;
  isEnabled?: boolean;
};

export function buildMemberSelection(member: MemberLike): MemberPickerSelection {
  const memberId = member.memberId || '';
  const displayName = member.displayName || member.nickname || member.mobile || memberId;

  return {
    memberId,
    nickname: member.nickname,
    mobile: member.mobile,
    levelName: member.levelName,
    avatar: member.avatar,
    displayName,
  };
}

export function buildTenantSelection(tenant: TenantLike): TenantPickerSelection {
  const tenantId = tenant.tenantId === undefined || tenant.tenantId === null ? '' : String(tenant.tenantId);
  const displayName = tenant.displayName || tenant.companyName || tenantId;

  return {
    tenantId,
    companyName: tenant.companyName,
    contactUserName: tenant.contactUserName,
    contactPhone: tenant.contactPhone,
    displayName,
  };
}

function resolveProductSkuIds(product: ProductLike, sku?: ProductLike) {
  const productId = String(product.productId || product.id || '');
  const skuId = sku?.skuId ? String(sku.skuId) : undefined;
  return { productId, skuId };
}

function resolveProductDisplay(product: ProductLike, sku: ProductLike | undefined, productId: string) {
  const displayName = product.displayName || product.name || product.productName || productId;
  const specLabel = normalizeSpecLabel(sku?.specValues || sku?.specLabel);
  const name = specLabel ? `${displayName} - ${specLabel}` : displayName;
  return { displayName, specLabel, name };
}

function resolveProductPricing(sku: ProductLike | undefined, product: ProductLike) {
  return {
    type: sku?.type || product.type,
    price: sku?.guidePrice || sku?.price || product.price || product.guidePrice,
    guidePrice: sku?.guidePrice || product.guidePrice,
  };
}

export function buildProductSelection(product: ProductLike, sku?: ProductLike): ProductPickerSelection {
  const { productId, skuId } = resolveProductSkuIds(product, sku);
  const { displayName, specLabel, name } = resolveProductDisplay(product, sku, productId);
  const { type, price, guidePrice } = resolveProductPricing(sku, product);

  return {
    ...product,
    ...(sku || {}),
    id: skuId || productId,
    productId,
    skuId,
    name,
    productName: product.productName || product.name || product.displayName,
    displayName,
    specLabel: specLabel || undefined,
    type,
    price,
    guidePrice,
    mainImages: product.mainImages || (product.coverImage ? [product.coverImage] : undefined),
    coverImage: product.coverImage,
    subTitle: product.subTitle,
    skus: product.skus,
    globalSkus: product.globalSkus,
    specValues: sku?.specValues,
  };
}

function resolveCouponTemplateId(template: CouponTemplateLike) {
  return String(template.templateId || template.id || '');
}

function resolveCouponTemplateName(template: CouponTemplateLike, templateId: string) {
  return template.name || template.displayName || templateId;
}

function resolveCouponTemplateDiscountAmount(template: CouponTemplateLike) {
  if (typeof template.discountAmount === 'number') return template.discountAmount;
  if (template.type === 'DISCOUNT' && typeof template.value === 'number') return template.value;
  return undefined;
}

function resolveCouponTemplateDiscountPercent(template: CouponTemplateLike) {
  if (typeof template.discountPercent === 'number') return template.discountPercent;
  if (template.type === 'PERCENTAGE' && typeof template.value === 'number') return template.value;
  return undefined;
}

function resolveCouponTemplateStartTime(template: CouponTemplateLike) {
  return template.startTime || template.validStartTime;
}

function resolveCouponTemplateEndTime(template: CouponTemplateLike) {
  return template.endTime || template.validEndTime;
}

export function buildCouponTemplateSelection(template: CouponTemplateLike): CouponTemplatePickerSelection {
  const templateId = resolveCouponTemplateId(template);
  const name = resolveCouponTemplateName(template, templateId);

  return {
    id: templateId,
    templateId,
    name,
    displayName: template.displayName || name,
    description: template.description,
    type: template.type,
    discountAmount: resolveCouponTemplateDiscountAmount(template),
    discountPercent: resolveCouponTemplateDiscountPercent(template),
    minOrderAmount: template.minOrderAmount ?? template.minAmount,
    status: template.status,
    validDays: template.validDays,
    startTime: resolveCouponTemplateStartTime(template),
    endTime: resolveCouponTemplateEndTime(template),
  };
}

export function buildPointsTaskSelection(task: PointsTaskLike): PointsTaskPickerSelection {
  const taskId = String(task.taskId || task.id || '');
  const taskName = task.taskName || task.displayName || task.taskKey || taskId;

  return {
    id: taskId,
    taskId,
    taskKey: task.taskKey || '',
    taskName,
    displayName: task.displayName || taskName,
    taskDescription: task.taskDescription,
    pointsReward: task.pointsReward,
    isRepeatable: task.isRepeatable,
    maxCompletions: task.maxCompletions,
    isEnabled: task.isEnabled,
  };
}

function normalizeSpecLabel(specValues: ProductLike['specValues'] | string | undefined) {
  if (!specValues) return '';

  if (typeof specValues === 'string') {
    try {
      const parsed = JSON.parse(specValues) as Record<string, unknown>;
      return joinSpecValues(parsed);
    } catch {
      return specValues;
    }
  }

  return joinSpecValues(specValues);
}

function joinSpecValues(specValues: Record<string, unknown>) {
  return Object.values(specValues)
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map((value) => String(value))
    .join(' / ');
}

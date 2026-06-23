import type {
  ClientProduct,
  ProductDisplayTag,
  ProductPurchaseStatus,
  ProductServiceSummary,
} from '@libs/common-types';
import type { SeniorProductCardModel, SeniorProductCardVariant } from './product-card.types';
import type { ProductCardView } from '@/api/marketing';
import type { ClientAggregateProductCard } from '@/api/product';

const PLACEHOLDER_IMAGE = '/static/images/placeholder.png';

interface SeniorCardMapperOptions {
  variant?: SeniorProductCardVariant;
  moduleName?: string;
  sceneCode?: string;
  moduleCode?: string;
  entrySource?: string;
  actionText?: string;
}

type AggregateProductCardInput = ClientAggregateProductCard & {
  entrySceneCode?: string;
  entryModuleCode?: string;
  entrySource?: string;
};

interface ActivitySummary {
  activityType?: string;
  activityContextKey?: string;
  currentPrice?: number;
  originalPrice?: number;
  priceLabel?: string;
  explain?: string;
}

interface SeniorProductCardOptionalInput {
  subtitle?: SeniorProductCardModel['subtitle'] | undefined;
  priceLabel?: SeniorProductCardModel['priceLabel'] | undefined;
  currentPrice?: SeniorProductCardModel['currentPrice'] | undefined;
  originalPrice?: SeniorProductCardModel['originalPrice'] | undefined;
  displayTags?: SeniorProductCardModel['displayTags'] | undefined;
  purchaseStatus?: SeniorProductCardModel['purchaseStatus'] | undefined;
  serviceSummary?: SeniorProductCardModel['serviceSummary'] | undefined;
  explain?: SeniorProductCardModel['explain'] | undefined;
  activityContextKey?: SeniorProductCardModel['activityContextKey'] | undefined;
  activityType?: SeniorProductCardModel['activityType'] | undefined;
  entrySceneCode?: SeniorProductCardModel['entrySceneCode'] | undefined;
  entryModuleCode?: SeniorProductCardModel['entryModuleCode'] | undefined;
  entrySource?: SeniorProductCardModel['entrySource'] | undefined;
}

interface ActivitySummaryInput {
  activityType?: ActivitySummary['activityType'] | undefined;
  activityContextKey?: ActivitySummary['activityContextKey'] | undefined;
  currentPrice?: ActivitySummary['currentPrice'] | undefined;
  originalPrice?: ActivitySummary['originalPrice'] | undefined;
  priceLabel?: ActivitySummary['priceLabel'] | undefined;
  explain?: ActivitySummary['explain'] | undefined;
}

function createSeniorProductCardModel(
  required: Pick<SeniorProductCardModel, 'actionText' | 'imageUrl' | 'productId' | 'title'>,
  optional: SeniorProductCardOptionalInput,
): SeniorProductCardModel {
  const model: SeniorProductCardModel = { ...required };
  if (optional.subtitle !== undefined) model.subtitle = optional.subtitle;
  if (optional.priceLabel !== undefined) model.priceLabel = optional.priceLabel;
  if (optional.currentPrice !== undefined) model.currentPrice = optional.currentPrice;
  if (optional.originalPrice !== undefined) model.originalPrice = optional.originalPrice;
  if (optional.displayTags !== undefined) model.displayTags = optional.displayTags;
  if (optional.purchaseStatus !== undefined) model.purchaseStatus = optional.purchaseStatus;
  if (optional.serviceSummary !== undefined) model.serviceSummary = optional.serviceSummary;
  if (optional.explain !== undefined) model.explain = optional.explain;
  if (optional.activityContextKey !== undefined) model.activityContextKey = optional.activityContextKey;
  if (optional.activityType !== undefined) model.activityType = optional.activityType;
  if (optional.entrySceneCode !== undefined) model.entrySceneCode = optional.entrySceneCode;
  if (optional.entryModuleCode !== undefined) model.entryModuleCode = optional.entryModuleCode;
  if (optional.entrySource !== undefined) model.entrySource = optional.entrySource;
  return model;
}

function createActivitySummary(optional: ActivitySummaryInput): ActivitySummary {
  const summary: ActivitySummary = {};
  if (optional.activityType !== undefined) summary.activityType = optional.activityType;
  if (optional.activityContextKey !== undefined) summary.activityContextKey = optional.activityContextKey;
  if (optional.currentPrice !== undefined) summary.currentPrice = optional.currentPrice;
  if (optional.originalPrice !== undefined) summary.originalPrice = optional.originalPrice;
  if (optional.priceLabel !== undefined) summary.priceLabel = optional.priceLabel;
  if (optional.explain !== undefined) summary.explain = optional.explain;
  return summary;
}

/**
 * 商品卡只消费展示用 view-model：offer 影响价格与 activityContextKey；
 * displayTags/purchaseStatus/serviceSummary 来自后端商品展示投影，前端只做排序和限量展示；
 * scene/module 仅作为跳转归因，不直接展示成商品标签。
 */
export function mapClientProductToSeniorCard(
  product: ClientProduct,
  options: SeniorCardMapperOptions = {},
): SeniorProductCardModel {
  const summary = readClientProductActivity(product);
  const basePrice = readNumber(product.price) ?? 0;
  const currentPrice = summary.currentPrice ?? basePrice;
  const originalPrice = normalizeOriginalPrice(summary.originalPrice ?? basePrice, currentPrice);
  const subtitle = readString(product.subTitle) || readString(product.categoryName);
  const displayTags = readDisplayTags(product.displayTags);
  const purchaseStatus = readPurchaseStatus(product.purchaseStatus);
  const serviceSummary = readServiceSummary(product.serviceSummary);

  return createSeniorProductCardModel(
    {
      productId: product.productId,
      title: product.name,
      imageUrl: pickImage(product.coverImage, product.mainImages),
      actionText: options.actionText || '查看详情',
    },
    {
      subtitle,
      priceLabel: summary.priceLabel,
      currentPrice,
      originalPrice,
      displayTags,
      purchaseStatus,
      serviceSummary,
      explain: summary.explain || serviceSummary?.label,
      activityContextKey: summary.activityContextKey,
      activityType: summary.activityType,
      entrySceneCode: options.sceneCode,
      entryModuleCode: options.moduleCode,
      entrySource: options.entrySource,
    },
  );
}

export function mapSceneProductToSeniorCard(
  product: ProductCardView,
  options: SeniorCardMapperOptions = {},
): SeniorProductCardModel | null {
  const record = toRecord(product);
  const productId = readString(record.productId);
  if (!productId) return null;

  const offer = readOffer(record);
  const activityType = readString(offer.activityType);
  const currentPrice = readNumber(offer.displayPrice) ?? readNumber(offer.activityPrice);
  const originalPrice = normalizeOriginalPrice(readNumber(offer.originalPrice), currentPrice);
  const images = readStringArray(record.productImages ?? record.mainImages);
  const displayTags = readDisplayTags(record.displayTags);
  const purchaseStatus = readPurchaseStatus(record.purchaseStatus);
  const serviceSummary = readServiceSummary(record.serviceSummary);

  return createSeniorProductCardModel(
    {
      productId,
      title: readString(record.productName) || readString(record.name) || options.moduleName || '商品',
      imageUrl: pickImage(readString(record.productImg) || readString(record.coverImage), images),
      actionText: options.actionText || '查看详情',
    },
    {
      priceLabel: resolvePriceLabel(offer),
      currentPrice,
      originalPrice,
      displayTags,
      purchaseStatus,
      serviceSummary,
      explain: resolveExplain(record, offer, activityType),
      activityContextKey: readString(offer.activityContextKey),
      activityType,
      entrySceneCode: options.sceneCode,
      entryModuleCode: options.moduleCode,
      entrySource: options.entrySource,
    },
  );
}

export function mapAggregateProductToSeniorCard(
  item: AggregateProductCardInput,
  options: SeniorCardMapperOptions = {},
): SeniorProductCardModel {
  const activity = item.mainActivity;
  const activityRecord = toRecord(activity);
  const currentPrice = readNumber(activity.displayPrice);
  const displayTags = readDisplayTags(item.displayTags);
  const purchaseStatus = readPurchaseStatus(item.purchaseStatus);
  const serviceSummary = readServiceSummary(item.serviceSummary);

  return createSeniorProductCardModel(
    {
      productId: item.productId,
      title: item.productName,
      imageUrl: pickImage(item.productImg),
      actionText: options.actionText || '查看详情',
    },
    {
      priceLabel: resolvePriceLabel(activityRecord),
      currentPrice,
      originalPrice: normalizeOriginalPrice(readNumber(activity.originalPrice), currentPrice),
      displayTags,
      purchaseStatus,
      serviceSummary,
      explain: resolveExplain(toRecord(item), activityRecord, readString(activity.activityType)),
      activityContextKey: activity.activityContextKey,
      activityType: activity.activityType,
      entrySceneCode: options.sceneCode ?? item.entrySceneCode,
      entryModuleCode: options.moduleCode ?? item.entryModuleCode,
      entrySource: options.entrySource ?? item.entrySource,
    },
  );
}

function readClientProductActivity(product: ClientProduct): ActivitySummary {
  const ext = product as ClientProduct & {
    mainActivity?: unknown;
    primaryOffer?: unknown;
  };
  const record = readOffer({
    mainActivity: ext.mainActivity,
    mainActivitySummary: product.mainActivitySummary,
    primaryOffer: ext.primaryOffer,
  });
  const activityType = readString(record.activityType);
  const currentPrice = readNumber(record.displayPrice) ?? readNumber(record.activityPrice);

  return createActivitySummary({
    activityType,
    activityContextKey: readString(record.activityContextKey),
    currentPrice,
    originalPrice: readNumber(record.originalPrice),
    priceLabel: resolvePriceLabel(record),
    explain: resolveExplain(toRecord(product), record, activityType),
  });
}

function readOffer(productRecord: Record<string, unknown>): Record<string, unknown> {
  const mainActivity = toRecord(productRecord.mainActivity);
  if (Object.keys(mainActivity).length > 0) return mainActivity;
  const summary = toRecord(productRecord.mainActivitySummary);
  if (Object.keys(summary).length > 0) return summary;
  return toRecord(productRecord.primaryOffer);
}

function resolvePriceLabel(activity: Record<string, unknown>): string | undefined {
  const tagLabel = readString(activity.tagLabel);
  if (tagLabel) return tagLabel;
  const activityType = readString(activity.activityType);
  if (isCourseGroupActivity(activityType)) return '拼课价';
  return readString(activity.activityName) || undefined;
}

function resolveExplain(
  productRecord: Record<string, unknown>,
  activity: Record<string, unknown>,
  activityType?: string,
): string | undefined {
  const courseGroupExplain = toRecord(productRecord.courseGroupJoinExplain ?? activity.courseGroupJoinExplain);
  const courseGroupText = readString(courseGroupExplain.reasonText);
  if (isCourseGroupActivity(activityType) && courseGroupText) return courseGroupText;

  return (
    readString(activity.ruleSummary) ||
    readString(activity.lessonSummary) ||
    readString(activity.countText) ||
    readString(activity.scheduleText) ||
    readString(toRecord(productRecord.serviceSummary).label) ||
    undefined
  );
}

function readDisplayTags(value: unknown): ProductDisplayTag[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const tags = value
    .map((item): ProductDisplayTag | null => {
      const record = toRecord(item);
      const code = readString(record.code);
      const label = readString(record.label);
      const source = readString(record.source);
      const priority = readNumber(record.priority);
      if (!isDisplayTagCode(code) || !label || !isDisplayTagSource(source) || priority === undefined) {
        return null;
      }
      return { code, label, source, priority };
    })
    .filter((item): item is ProductDisplayTag => item !== null)
    .sort((a, b) => b.priority - a.priority);

  return tags.length > 0 ? tags : undefined;
}

function readPurchaseStatus(value: unknown): ProductPurchaseStatus | undefined {
  const record = toRecord(value);
  const code = readString(record.code);
  const label = readString(record.label);
  const purchasable = readBoolean(record.purchasable);
  if (!isPurchaseStatusCode(code) || !label || purchasable === undefined) return undefined;
  return { code, label, purchasable };
}

function readServiceSummary(value: unknown): ProductServiceSummary | undefined {
  const record = toRecord(value);
  const label = readString(record.label);
  const needBooking = readBoolean(record.needBooking);
  if (!label || needBooking === undefined) return undefined;

  return {
    label,
    needBooking,
    serviceDuration: readNullableNumber(record.serviceDuration),
    serviceRadius: readNullableNumber(record.serviceRadius),
  };
}

function isDisplayTagCode(value: string): value is ProductDisplayTag['code'] {
  return value === 'NEW' || value === 'STORE_RECOMMEND' || value === 'FREE_SHIPPING' || value === 'SERVICE_HOME';
}

function isDisplayTagSource(value: string): value is ProductDisplayTag['source'] {
  return value === 'RULE' || value === 'FACT' || value === 'MANUAL';
}

function isPurchaseStatusCode(value: string): value is ProductPurchaseStatus['code'] {
  return value === 'NORMAL' || value === 'BOOKING_REQUIRED';
}

function normalizeOriginalPrice(
  originalPrice: number | undefined,
  currentPrice: number | undefined,
): number | undefined {
  if (originalPrice === undefined || currentPrice === undefined) return undefined;
  return originalPrice > currentPrice ? originalPrice : undefined;
}

function pickImage(primary?: string, images?: string[]): string {
  return readString(primary) || images?.find((item) => readString(item)) || PLACEHOLDER_IMAGE;
}

function isCourseGroupActivity(activityType?: string): boolean {
  return readString(activityType).toUpperCase() === 'COURSE_GROUP';
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function readNullableNumber(value: unknown): number | null {
  return readNumber(value) ?? null;
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

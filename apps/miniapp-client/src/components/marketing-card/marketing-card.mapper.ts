import type {
  ClientProduct,
  ProductDisplayTag,
  ProductPurchaseStatus,
  ProductServiceSummary,
} from '@libs/common-types';
import type { ActivityKind, CardLayout, MarketingCardModel } from './marketing-card.types';
import type { ClientModuleView, ProductCardView } from '@/api/marketing';
import { isCourseGroupActivityType } from '@/constants/course-group';
import { formatClassDateTimeShort } from '@/utils/format-class-datetime';
import { getCtaPreset } from './marketing-cta-map';

const PLACEHOLDER_IMAGE = '/static/images/placeholder.png';

interface MapperOptions {
  sceneCode?: string;
  moduleCode?: string;
  entrySource?: string;
}

/** 分类页等窄栏列表：横版 split 卡的信息密度 */
export type MarketingCardListDensity = 'category';

interface ClientProductMapperOptions extends MapperOptions {
  listDensity?: MarketingCardListDensity;
}

/**
 * 将场景出数的 ProductCardView 映射为 MarketingCardModel。
 *
 * activityKind 识别 4 种 activityType：COURSE_GROUP / COURSE_GROUP_BUY → 'group',
 * FLASH_SALE → 'flash', MEMBER_PRICE → 'member', 其余 → 'normal'。
 *
 * title：有营销活动时优先 activityName，否则 productName。
 * priceLabel 优先级链：
 *   tagLabel 非空 > COURSE_GROUP 兜底 '拼课价' > activityName（未占用主标题时）> cta-map 兜底
 */
export function mapSceneProductToMarketingCard(
  product: ProductCardView,
  options: MapperOptions = {},
): MarketingCardModel | null {
  const record = toRecord(product);
  const productId = readString(record.productId);
  if (!productId) return null;

  const offer = readOffer(record);
  const activityType = readString(offer.activityType);
  const activityKind = resolveActivityKind(activityType);
  const preset = getCtaPreset(activityKind);
  const title = resolveCardTitle(record, offer, activityKind);

  const currentPrice = readNumber(offer.displayPrice) ?? readNumber(offer.activityPrice);
  const rawOriginal = readNumber(offer.originalPrice);
  const originalPrice = normalizeOriginalPrice(rawOriginal, currentPrice);
  const images = readStringArray(record.productImages ?? record.mainImages);
  const cardLayout = readCardLayout(record.cardLayout);

  return {
    productId,
    title,
    imageUrl: pickImage(readString(record.productImg) || readString(record.coverImage), images),
    actionText: preset.ctaText,
    priceLabel: resolvePriceLabel(offer, preset.priceLabel, title),
    currentPrice,
    originalPrice,
    displayTags: readDisplayTags(record.displayTags),
    purchaseStatus: readPurchaseStatus(record.purchaseStatus),
    serviceSummary: readServiceSummary(record.serviceSummary),
    explain: resolveExplain(record, offer, activityType),
    activityContextKey: readString(offer.activityContextKey) || undefined,
    activityType: activityType || undefined,
    entrySceneCode: options.sceneCode,
    entryModuleCode: options.moduleCode,
    entrySource: options.entrySource,
    cardLayout,
    activityKind,
    badgeText: preset.badgeText || undefined,
    secondaryHint: resolveSecondaryHint(record, offer, activityKind),
    ...extractCourseGroupProgress(record, offer),
    ...extractGroupFooterFields(record, offer, activityKind),
  };
}

/**
 * 批量映射一个模块内的所有 products。
 */
export function mapModuleToMarketingCards(module: ClientModuleView, options: MapperOptions = {}): MarketingCardModel[] {
  return module.products
    .map((p) =>
      mapSceneProductToMarketingCard(p, {
        sceneCode: options.sceneCode,
        moduleCode: module.moduleCode,
        entrySource: options.entrySource,
      }),
    )
    .filter((m): m is MarketingCardModel => m !== null);
}

/**
 * 商品列表 API（ClientProduct）→ 营销卡模型；分类页竖版卡用 listDensity: 'category'。
 */
export function mapClientProductToMarketingCard(
  product: ClientProduct,
  options: ClientProductMapperOptions = {},
): MarketingCardModel | null {
  const productId = readString(product.productId);
  if (!productId) return null;

  const ext = product as ClientProduct & {
    mainActivity?: unknown;
    primaryOffer?: unknown;
    courseGroupJoinExplain?: unknown;
  };

  const cardView = {
    productId,
    productName: readString(product.name) || '商品',
    name: product.name,
    coverImage: product.coverImage,
    productImages: product.mainImages,
    displayTags: product.displayTags,
    purchaseStatus: product.purchaseStatus,
    serviceSummary: product.serviceSummary,
    mainActivity: ext.mainActivity,
    mainActivitySummary: product.mainActivitySummary,
    primaryOffer: ext.primaryOffer,
    courseGroupJoinExplain: ext.courseGroupJoinExplain,
    subTitle: product.subTitle,
  } as ProductCardView;

  const model = mapSceneProductToMarketingCard(cardView, options);
  if (!model) return null;

  model.cardLayout = 'split';

  const basePrice = readNumber(product.price);
  if (model.currentPrice === undefined && basePrice !== undefined) {
    model.currentPrice = basePrice;
  }
  if (model.originalPrice === undefined && basePrice !== undefined && model.currentPrice !== undefined) {
    model.originalPrice = normalizeOriginalPrice(basePrice, model.currentPrice);
  }

  if (options.listDensity === 'category') {
    applyCategoryListDensity(model);
  }

  return model;
}

/** 分类竖版卡：仅主图 + 标题 + 价 + 按钮，标签由角标承载 */
function applyCategoryListDensity(model: MarketingCardModel): void {
  model.explain = undefined;
  model.displayTags = undefined;
}

export function resolveActivityKind(activityType: string): ActivityKind {
  if (isCourseGroupActivityType(activityType)) return 'group';
  const upper = activityType.toUpperCase();
  if (upper === 'FLASH_SALE') return 'flash';
  if (upper === 'MEMBER_PRICE') return 'member';
  return 'normal';
}

/**
 * 读取活动展示名。列表接口 mainActivitySummary 常只带 tagLabel（= 活动名），不带 activityName。
 */
function readMarketingActivityName(offer: Record<string, unknown>, activityKind: ActivityKind): string {
  const activityName = readString(offer.activityName);
  if (activityName) return activityName;
  if (activityKind === 'normal') return '';
  return readString(offer.tagLabel);
}

/**
 * 营销商品卡片主标题：有活动时优先展示活动名，避免与商品名并列重复。
 * 详情页仍保留完整商品名，列表/专区卡只做这一处收敛。
 */
function resolveCardTitle(
  productRecord: Record<string, unknown>,
  offer: Record<string, unknown>,
  activityKind: ActivityKind,
): string {
  const productName = readString(productRecord.productName) || readString(productRecord.name) || '商品';
  const marketingName = readMarketingActivityName(offer, activityKind);
  if (activityKind !== 'normal' && marketingName) {
    return marketingName;
  }
  return productName;
}

/**
 * priceLabel 优先级：tagLabel > COURSE_GROUP '拼课价' > activityName > cta-map 兜底。
 * tagLabel / activityName 与主标题相同时跳过，避免「创意绘画拼课」标题下再叠一遍同名价签。
 */
function resolvePriceLabel(offer: Record<string, unknown>, fallback: string, cardTitle: string): string | undefined {
  const tagLabel = readString(offer.tagLabel);
  if (tagLabel && tagLabel !== cardTitle) return tagLabel;
  const activityType = readString(offer.activityType);
  if (isCourseGroupActivityType(activityType)) return '拼课价';
  const activityName = readMarketingActivityName(offer, resolveActivityKind(readString(offer.activityType)));
  if (activityName && activityName !== cardTitle) return activityName;
  return fallback || undefined;
}

/** 统一收敛 courseGroupJoinExplain 读取：同时支持 product 顶层和 offer 内嵌路径 */
function extractCourseGroupExplain(
  productRecord: Record<string, unknown>,
  offer: Record<string, unknown>,
): Record<string, unknown> {
  return toRecord(productRecord.courseGroupJoinExplain ?? offer.courseGroupJoinExplain);
}

function extractCourseGroupProgress(
  productRecord: Record<string, unknown>,
  offer: Record<string, unknown>,
): Pick<MarketingCardModel, 'remainingSlots' | 'remainToForm' | 'teamStatus'> {
  const explain = extractCourseGroupExplain(productRecord, offer);
  const minCount = readNumber(explain.minCount);
  const effective = readNumber(explain.effectiveMemberCount);
  const remainingToForm =
    readNumber(explain.remainingToForm) ??
    (minCount != null && effective != null ? Math.max(0, minCount - effective) : undefined);

  return {
    remainingSlots: readNumber(explain.remainingSlots),
    remainToForm: remainingToForm,
    teamStatus: readString(explain.teamStatus) || undefined,
  };
}

function resolveExplain(
  productRecord: Record<string, unknown>,
  offer: Record<string, unknown>,
  activityType: string,
): string | undefined {
  // 拼课地点/时间/参团信息仅在大卡 Footer 展示，小卡不输出 explain
  if (isCourseGroupActivityType(activityType)) {
    return undefined;
  }

  return (
    readString(offer.ruleSummary) ||
    readString(offer.lessonSummary) ||
    readString(offer.countText) ||
    readString(offer.scheduleText) ||
    readString(toRecord(productRecord.serviceSummary).label) ||
    undefined
  );
}

function extractGroupFooterFields(
  productRecord: Record<string, unknown>,
  offer: Record<string, unknown>,
  activityKind: ActivityKind,
): Pick<MarketingCardModel, 'groupClassAddress' | 'groupClassTime' | 'groupJoinHint'> {
  if (activityKind !== 'group') return {};

  const explain = extractCourseGroupExplain(productRecord, offer);
  const rules = toRecord(offer.rules);
  const address =
    readString(explain.classAddress) || readString(offer.classAddress) || readString(rules.classAddress) || undefined;
  const classTime = formatClassDateTimeShort(explain.classStartTime ?? offer.classStartTime ?? rules.classStartTime);
  const joinHint = readString(explain.reasonText) || undefined;

  return {
    groupClassAddress: address,
    groupClassTime: classTime,
    groupJoinHint: joinHint,
  };
}

function resolveSecondaryHint(
  productRecord: Record<string, unknown>,
  offer: Record<string, unknown>,
  activityKind: ActivityKind,
): string | undefined {
  if (activityKind === 'group') {
    const explain = extractCourseGroupExplain(productRecord, offer);
    const status = readString(explain.teamStatus).toUpperCase();
    const toForm =
      readNumber(explain.remainingToForm) ??
      (() => {
        const min = readNumber(explain.minCount);
        const effective = readNumber(explain.effectiveMemberCount);
        return min != null && effective != null ? Math.max(0, min - effective) : undefined;
      })();
    if (status === 'RECRUITING' && toForm != null && toForm > 0) {
      return `还差${toForm}人即可成团`;
    }
    const cap = readNumber(explain.remainingSlots);
    if ((status === 'FORMED' || status === 'IN_CLASS') && cap != null && cap > 0) {
      return `剩余${cap}个名额`;
    }
    return undefined;
  }
  if (activityKind === 'flash') {
    const stock = readNumber(offer.remainingStock);
    if (stock != null && stock > 0) return `还剩${stock}份`;
    return undefined;
  }
  return undefined;
}

function readCardLayout(value: unknown): CardLayout | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim().toLowerCase();
  if (v === 'overlay' || v === 'split' || v === 'auto') return v;
  return undefined;
}

function readOffer(productRecord: Record<string, unknown>): Record<string, unknown> {
  const mainActivity = toRecord(productRecord.mainActivity);
  if (Object.keys(mainActivity).length > 0) return mainActivity;
  const summary = toRecord(productRecord.mainActivitySummary);
  if (Object.keys(summary).length > 0) return summary;
  return toRecord(productRecord.primaryOffer);
}

function normalizeOriginalPrice(
  originalPrice: number | undefined,
  currentPrice: number | undefined,
): number | undefined {
  if (originalPrice === undefined || currentPrice === undefined) return undefined;
  return originalPrice > currentPrice ? originalPrice : undefined;
}

function pickImage(primary?: string, images?: string[]): string {
  return primary || images?.find((item) => Boolean(item)) || PLACEHOLDER_IMAGE;
}

function readDisplayTags(value: unknown): ProductDisplayTag[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const tags = value
    .map((item) => {
      const r = toRecord(item);
      const code = readString(r.code);
      const label = readString(r.label);
      const source = readString(r.source);
      const priority = readNumber(r.priority);
      if (!isDisplayTagCode(code) || !label || !isDisplayTagSource(source) || priority === undefined) return null;
      return { code, label, source, priority } as ProductDisplayTag;
    })
    .filter((t): t is ProductDisplayTag => t !== null)
    .sort((a, b) => b.priority - a.priority);
  return tags.length > 0 ? tags : undefined;
}

function readPurchaseStatus(value: unknown): ProductPurchaseStatus | undefined {
  const r = toRecord(value);
  const code = readString(r.code);
  const label = readString(r.label);
  const purchasable = readBoolean(r.purchasable);
  if (!isPurchaseStatusCode(code) || !label || purchasable === undefined) return undefined;
  return { code, label, purchasable };
}

function readServiceSummary(value: unknown): ProductServiceSummary | undefined {
  const r = toRecord(value);
  const label = readString(r.label);
  const needBooking = readBoolean(r.needBooking);
  if (!label || needBooking === undefined) return undefined;
  return {
    label,
    needBooking,
    serviceDuration: readNumber(r.serviceDuration) ?? null,
    serviceRadius: readNumber(r.serviceRadius) ?? null,
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

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === 'string') {
    const n = value.trim().toLowerCase();
    if (n === 'true' || n === '1') return true;
    if (n === 'false' || n === '0') return false;
  }
  return undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

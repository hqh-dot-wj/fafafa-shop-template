import { Injectable, Logger, Optional } from '@nestjs/common';
import { DelFlag, MktCampaignStatus, Prisma, PublishStatus, Status } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResolutionService } from 'src/module/marketing/resolution/resolution.service';
import type { ResolvedActivityContextVo } from 'src/module/marketing/resolution/vo/resolved-activity-context.vo';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { Result } from 'src/common/response/result';
import { getErrorMessage } from 'src/common/utils/error';
import { RedisService } from 'src/module/common/redis/redis.service';
import type {
  ProductDisplayTagProjection,
  ProductPurchaseStatusProjection,
  ProductServiceSummaryProjection,
} from 'src/module/pms/product-display-projection.util';
import { resolveMarketingTraceId } from 'src/module/marketing/common/trace-id.util';
import { MARKETING_CLIENT_AGGREGATE_ENABLED_KEY } from 'src/module/marketing/marketing-client-runtime.constants';
import type { UserMarketingContext } from 'src/module/marketing/resolution/dto/user-marketing-context.dto';
import {
  MARKETING_AGGREGATE_TENANT_SET_KEY,
  MARKETING_COMPAT_TENANT_SET_KEY,
  marketingAggregateDailyCountKey,
  marketingAggregateEverUsedKey,
  marketingCompatDailyCountKey,
  marketingCompatEverUsedKey,
} from 'src/module/marketing/marketing-aggregate-traffic.constants';
import { ClientSceneService, type SceneModulesResult } from '../scene/client-scene.service';

export interface ClientAggregateProductCard {
  productId: string;
  productName: string;
  productImg: string;
  mainActivity: {
    activityContextKey: string;
    activityType: string;
    configId: string;
    activityName: string;
    displayPrice: number;
    originalPrice: number;
    tagLabel: string;
    statusSummary: string;
    countdownEndTime: Date | null;
    remainingSlots: number | null;
  };
  fallbackActivities: Array<{ activityContextKey: string; activityType: string }>;
  displayTags?: ProductDisplayTagProjection[];
  purchaseStatus?: ProductPurchaseStatusProjection;
  serviceSummary?: ProductServiceSummaryProjection;
}

type EligibilityHint = {
  isNewcomer?: boolean;
  memberLevel?: string;
};

const MAX_PAGE_SIZE = 50;

const AGGREGATE_COUNT_TTL_MS = 10 * 24 * 60 * 60 * 1000;
const COMPAT_COUNT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const AGGREGATE_SCENE_CODE = 'HOME_FEATURED';
const AGGREGATE_SCENE_MODULE_LIMIT = 20;
const AGGREGATE_SCENE_PRODUCT_LIMIT = 50;

@Injectable()
export class ClientAggregateService {
  private readonly logger = new Logger(ClientAggregateService.name);

  constructor(
    private readonly clientSceneService: ClientSceneService,
    private readonly prisma: PrismaService,
    private readonly resolutionService: ResolutionService,
    private readonly redisService: RedisService,
    private readonly tenantHelper: TenantHelper,
    @Optional() private readonly cls?: ClsService,
  ) {}

  /**
   * 鑾峰彇钀ラ攢鑱氬悎鍟嗗搧鍒楄〃锛堟寜鍟嗗搧鍘婚噸锛屾瘡涓晢鍝佸彧灞曠ず涓绘椿鍔級
   *
   * @param memberId - 褰撳墠浼氬憳 ID
   * @param pageNum - 椤电爜锛堜粠 1 寮€濮嬶級
   * @param pageSize - 姣忛〉鏉℃暟
   * @returns 鑱氬悎鍗＄墖鍒楄〃
   *
   * @description
   * - 鏅€氱鎴凤細浠呮湰搴?`aggregateEnabled` 鐨勪笂鏋剁帺娉曘€?   * - 鏈甫澶存垨瓒呯骇绉熸埛锛堜笌 C 绔?`ClientProductService.findAll` 鍥炶惤瓒呯骇绉熸埛鐨勫彲娴忚璇箟涓€鑷达級锛氳法绉熸埛姹囨€荤鍚堟潯浠剁殑鐜╂硶锛屾寜 `serviceId` 鍘婚噸鍒嗛〉锛?   *   涓绘椿鍔ㄨ鍐充娇鐢ㄣ€岃鍟嗗搧涓嬪瓧鍏稿簭鏈€灏忕殑 tenantId銆嶅搴旈棬搴楃殑鍊欓€夐厤缃紝渚夸簬娴忚鎬婚儴/鏈€夊簵鍦烘櫙銆?   */
  async getAggregateProducts(
    memberId: string,
    pageNum = 1,
    pageSize = 20,
  ): Promise<Result<ClientAggregateProductCard[]>> {
    const { safePageNum, safePageSize } = this.normalizePageParams(pageNum, pageSize);
    const rawTenantId = TenantContext.getTenantId();
    const switchTenantId =
      !rawTenantId || rawTenantId === TenantContext.SUPER_TENANT_ID ? TenantContext.SUPER_TENANT_ID : rawTenantId;
    await this.assertAggregateEnabled(switchTenantId);
    void this.recordAggregateTraffic(switchTenantId).catch((error) => {
      this.logger.warn(`璁板綍鑱氬悎鎺ュ彛娴侀噺澶辫触 tenant=${switchTenantId}: ${getErrorMessage(error)}`);
    });

    const tenantId = rawTenantId;
    if (!tenantId || tenantId === TenantContext.SUPER_TENANT_ID) {
      return this.getAggregateProductsForPlatformScope(memberId, safePageNum, safePageSize);
    }

    const configs = await this.prisma.storePlayConfig.findMany({
      where: {
        tenantId,
        status: PublishStatus.ON_SHELF,
        delFlag: DelFlag.NORMAL,
        aggregateEnabled: true,
      },
      select: { serviceId: true },
      distinct: ['serviceId'],
      orderBy: { serviceId: 'asc' },
      skip: (safePageNum - 1) * safePageSize,
      take: safePageSize,
    });

    const productIds = configs.map((c) => c.serviceId);
    if (productIds.length === 0) {
      return Result.ok([]);
    }

    const products = await this.prisma.pmsProduct.findMany({
      where: { productId: { in: productIds }, publishStatus: PublishStatus.ON_SHELF },
      select: { productId: true, name: true, mainImages: true },
    });
    const eligibilityHint = await this.loadMemberEligibilityHint(tenantId, memberId);

    const activityByProduct = await this.resolutionService.resolveMainActivitiesBatch({
      tenantId,
      memberId,
      productIds: products.map((p) => p.productId),
      isNewcomer: eligibilityHint.isNewcomer,
      memberLevel: eligibilityHint.memberLevel,
    });

    const cards = products
      .map((product) => {
        try {
          const activity = activityByProduct.get(product.productId) ?? null;
          if (!activity) {
            return null;
          }
          return {
            productId: product.productId,
            productName: product.name,
            productImg: product.mainImages[0] ?? '',
            mainActivity: {
              activityContextKey: activity.activityContextKey,
              activityType: activity.activityType,
              configId: activity.configId,
              activityName: activity.activityName,
              displayPrice: Number(activity.activityPrice),
              originalPrice: Number(activity.originalPrice),
              tagLabel: activity.activityName,
              statusSummary: activity.status,
              countdownEndTime: activity.endTime,
              remainingSlots: activity.remainingStock,
            },
            fallbackActivities: [],
          } as ClientAggregateProductCard;
        } catch (error) {
          this.logger.warn(`鑱氬悎椤典富娲诲姩瑁佸喅澶辫触 productId=${product.productId}: ${getErrorMessage(error)}`);
          return null;
        }
      })
      .filter((card): card is ClientAggregateProductCard => card !== null);

    return Result.ok(cards);
  }

  /**
   * 兼容入口仅转发 scene 主链路，不再回退 legacy 聚合查询。
   */
  async getAggregateProductsViaScene(
    memberId: string,
    pageNum = 1,
    pageSize = 20,
  ): Promise<Result<ClientAggregateProductCard[]>> {
    const { safePageNum, safePageSize } = this.normalizePageParams(pageNum, pageSize);
    const traceId = resolveMarketingTraceId(undefined, this.cls);
    const tenantId = TenantContext.getTenantId();
    if (tenantId && tenantId !== TenantContext.SUPER_TENANT_ID) {
      void this.recordCompatibilityTraffic(tenantId).catch((error) => {
        this.logger.warn(
          `记录 aggregate 兼容入口调用量失败 tenant=${tenantId} traceId=${traceId}: ${getErrorMessage(error)}`,
        );
      });
    }

    const cards = await this.fetchAggregateCardsViaScene(memberId, safePageNum, safePageSize, traceId);
    return Result.ok(cards);
  }

  /**
   * 瓒呯骇绉熸埛 / 鏈В鏋愮鎴凤細璺ㄥ簵鑱氬悎
   */
  private async getAggregateProductsForPlatformScope(
    memberId: string,
    pageNum: number,
    pageSize: number,
  ): Promise<Result<ClientAggregateProductCard[]>> {
    const { safePageNum, safePageSize } = this.normalizePageParams(pageNum, pageSize);
    const baseWhere = {
      status: PublishStatus.ON_SHELF,
      delFlag: DelFlag.NORMAL,
      aggregateEnabled: true,
    };

    const grouped = await this.prisma.storePlayConfig.groupBy({
      by: ['serviceId'],
      where: baseWhere,
      orderBy: { serviceId: 'asc' },
      skip: Math.max(0, (safePageNum - 1) * safePageSize),
      take: safePageSize,
    });

    const productIds = grouped.map((g) => g.serviceId);
    if (productIds.length === 0) {
      return Result.ok([]);
    }

    const configRows = await this.prisma.storePlayConfig.findMany({
      where: {
        ...baseWhere,
        serviceId: { in: productIds },
      },
      select: { serviceId: true, tenantId: true },
      orderBy: [{ serviceId: 'asc' }, { tenantId: 'asc' }],
    });

    const tenantByProduct = new Map<string, string>();
    for (const row of configRows) {
      if (!tenantByProduct.has(row.serviceId)) {
        tenantByProduct.set(row.serviceId, row.tenantId);
      }
    }

    const products = await this.prisma.pmsProduct.findMany({
      where: { productId: { in: productIds }, publishStatus: PublishStatus.ON_SHELF },
      select: { productId: true, name: true, mainImages: true },
    });
    const productById = new Map(products.map((p) => [p.productId, p]));
    const eligibilityHintCache = new Map<string, Promise<EligibilityHint>>();
    const productIdsByTenant = new Map<string, string[]>();
    for (const productId of productIds) {
      const resolveTenantId = tenantByProduct.get(productId);
      if (!resolveTenantId) {
        continue;
      }
      const list = productIdsByTenant.get(resolveTenantId) ?? [];
      list.push(productId);
      productIdsByTenant.set(resolveTenantId, list);
    }

    const activityByProductId = new Map<string, ResolvedActivityContextVo | null>();
    for (const [resolveTenantId, ids] of productIdsByTenant) {
      if (!eligibilityHintCache.has(resolveTenantId)) {
        eligibilityHintCache.set(resolveTenantId, this.loadMemberEligibilityHint(resolveTenantId, memberId));
      }
      const eligibilityHint = await eligibilityHintCache.get(resolveTenantId)!;
      const batch = await this.resolutionService.resolveMainActivitiesBatch({
        tenantId: resolveTenantId,
        memberId,
        productIds: ids,
        isNewcomer: eligibilityHint.isNewcomer,
        memberLevel: eligibilityHint.memberLevel,
      });
      for (const [pid, activity] of batch) {
        activityByProductId.set(pid, activity);
      }
    }

    const cards = productIds
      .map((productId) => {
        const product = productById.get(productId);
        if (!product) {
          return null;
        }
        try {
          const activity = activityByProductId.get(product.productId) ?? null;
          if (!activity) {
            return null;
          }
          return {
            productId: product.productId,
            productName: product.name,
            productImg: product.mainImages[0] ?? '',
            mainActivity: {
              activityContextKey: activity.activityContextKey,
              activityType: activity.activityType,
              configId: activity.configId,
              activityName: activity.activityName,
              displayPrice: Number(activity.activityPrice),
              originalPrice: Number(activity.originalPrice),
              tagLabel: activity.activityName,
              statusSummary: activity.status,
              countdownEndTime: activity.endTime,
              remainingSlots: activity.remainingStock,
            },
            fallbackActivities: [],
          } as ClientAggregateProductCard;
        } catch (error) {
          this.logger.warn(`鑱氬悎椤典富娲诲姩瑁佸喅澶辫触 productId=${product.productId}: ${getErrorMessage(error)}`);
          return null;
        }
      })
      .filter((card): card is ClientAggregateProductCard => card !== null);

    return Result.ok(cards);
  }

  private async fetchAggregateCardsViaScene(
    memberId: string,
    pageNum: number,
    pageSize: number,
    traceId: string,
  ): Promise<ClientAggregateProductCard[]> {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId || tenantId === TenantContext.SUPER_TENANT_ID) {
      return [];
    }

    const eligibilityHint = await this.loadMemberEligibilityHint(tenantId, memberId);
    const userContext: UserMarketingContext = {
      tenantId,
      memberId,
      channel: 'MINIAPP',
      now: new Date(),
      isNewcomer: eligibilityHint.isNewcomer ?? false,
      memberLevel: eligibilityHint.memberLevel,
      traceId,
    };

    const sceneResult = await this.clientSceneService.getSceneModules(AGGREGATE_SCENE_CODE, userContext, {
      moduleLimit: AGGREGATE_SCENE_MODULE_LIMIT,
      productLimit: AGGREGATE_SCENE_PRODUCT_LIMIT,
    });
    const cards = this.mapSceneModulesToAggregateCards(sceneResult);
    return this.paginateCards(cards, pageNum, pageSize);
  }

  private mapSceneModulesToAggregateCards(sceneResult: SceneModulesResult): ClientAggregateProductCard[] {
    const dedup = new Map<string, ClientAggregateProductCard>();
    for (const module of sceneResult.modules ?? []) {
      for (const product of module.products ?? []) {
        const card = this.buildAggregateCardFromSceneProduct(module, product);
        if (card && !dedup.has(card.productId)) {
          dedup.set(card.productId, card);
        }
      }
    }
    return [...dedup.values()];
  }

  private buildAggregateCardFromSceneProduct(
    module: SceneModulesResult['modules'][number],
    product: SceneModulesResult['modules'][number]['products'][number],
  ): ClientAggregateProductCard | null {
    const productRecord = this.toRecord(product);
    const productId = this.readString(productRecord.productId);
    if (!productId) {
      return null;
    }

    const primaryOffer = this.toRecord(productRecord.primaryOffer);
    const activityContextKey = this.readString(primaryOffer.activityContextKey);
    if (!activityContextKey) {
      return null;
    }

    const activityName = this.readString(primaryOffer.activityName) ?? module.moduleName;
    const displayPrice = this.readNumber(primaryOffer.displayPrice) ?? 0;
    const originalPrice = this.readNumber(primaryOffer.originalPrice) ?? displayPrice;
    const countdownEndTime = this.parseDate(this.readString(primaryOffer.countdownEndTime));
    const remainingSlots = this.readNumber(primaryOffer.remainingSlots);
    const displayTags = this.readDisplayTags(productRecord.displayTags);
    const purchaseStatus = this.readPurchaseStatus(productRecord.purchaseStatus);
    const serviceSummary = this.readServiceSummary(productRecord.serviceSummary);

    return {
      productId,
      productName: this.readString(productRecord.productName) ?? activityName,
      productImg: this.readString(productRecord.productImg) ?? '',
      mainActivity: {
        activityContextKey,
        activityType: this.readString(primaryOffer.activityType) ?? 'UNKNOWN',
        configId: this.readString(primaryOffer.configId) ?? `${module.moduleCode}:${productId}`,
        activityName,
        displayPrice,
        originalPrice,
        tagLabel: this.readString(primaryOffer.tagLabel) ?? activityName,
        statusSummary: this.readString(primaryOffer.statusSummary) ?? PublishStatus.ON_SHELF,
        countdownEndTime,
        remainingSlots,
      },
      fallbackActivities: [],
      displayTags,
      purchaseStatus,
      serviceSummary,
    };
  }

  private paginateCards(
    cards: ClientAggregateProductCard[],
    pageNum: number,
    pageSize: number,
  ): ClientAggregateProductCard[] {
    const start = Math.max(0, (pageNum - 1) * pageSize);
    return cards.slice(start, start + pageSize);
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private readRecord(value: unknown): Record<string, unknown> | undefined {
    const record = this.toRecord(value);
    return Object.keys(record).length > 0 ? record : undefined;
  }

  private readRecordList(value: unknown): Record<string, unknown>[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }
    const records = value.filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === 'object' && !Array.isArray(item)),
    );
    return records.length > 0 ? records : undefined;
  }

  private readDisplayTags(value: unknown): ProductDisplayTagProjection[] | undefined {
    const records = this.readRecordList(value);
    if (!records) {
      return undefined;
    }

    const tags = records
      .map((record): ProductDisplayTagProjection | null => {
        const code = this.readString(record.code);
        const label = this.readString(record.label);
        const source = this.readString(record.source);
        const priority = this.readNumber(record.priority);
        if (!this.isDisplayTagCode(code) || !label || !this.isDisplayTagSource(source) || priority === null) {
          return null;
        }
        return { code, label, source, priority };
      })
      .filter((item): item is ProductDisplayTagProjection => item !== null);

    return tags.length > 0 ? tags : undefined;
  }

  private readPurchaseStatus(value: unknown): ProductPurchaseStatusProjection | undefined {
    const record = this.readRecord(value);
    if (!record) {
      return undefined;
    }

    const code = this.readString(record.code);
    const label = this.readString(record.label);
    const purchasable = this.readBoolean(record.purchasable);
    if (!this.isPurchaseStatusCode(code) || !label || purchasable === null) {
      return undefined;
    }
    return { code, label, purchasable };
  }

  private readServiceSummary(value: unknown): ProductServiceSummaryProjection | undefined {
    const record = this.readRecord(value);
    if (!record) {
      return undefined;
    }

    const label = this.readString(record.label);
    const needBooking = this.readBoolean(record.needBooking);
    if (!label || needBooking === null) {
      return undefined;
    }
    return {
      label,
      needBooking,
      serviceDuration: this.readNumber(record.serviceDuration),
      serviceRadius: this.readNumber(record.serviceRadius),
    };
  }

  private isDisplayTagCode(value: string | null): value is ProductDisplayTagProjection['code'] {
    return value === 'NEW' || value === 'STORE_RECOMMEND' || value === 'FREE_SHIPPING' || value === 'SERVICE_HOME';
  }

  private isDisplayTagSource(value: string | null): value is ProductDisplayTagProjection['source'] {
    return value === 'RULE' || value === 'FACT' || value === 'MANUAL';
  }

  private isPurchaseStatusCode(value: string | null): value is ProductPurchaseStatusProjection['code'] {
    return value === 'NORMAL' || value === 'BOOKING_REQUIRED';
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private readNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  private readBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') return true;
      if (normalized === 'false' || normalized === '0') return false;
    }
    return null;
  }

  private parseDate(value: string | null): Date | null {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date;
  }

  private async loadMemberEligibilityHint(tenantId: string, memberId: string): Promise<EligibilityHint> {
    if (!memberId) {
      return {};
    }
    const [member, newcomerActivity] = await Promise.all([
      this.prisma.umsMember.findUnique({
        where: { memberId },
        select: { levelId: true },
      }),
      this.prisma.mktCampaign.findFirst({
        where: {
          tenantId,
          type: 'NEWCOMER_EXCLUSIVE',
          status: MktCampaignStatus.PUBLISHED,
        },
        select: { id: true },
      }),
    ]);

    let isNewcomer = false;
    if (newcomerActivity) {
      const participation = await this.prisma.mktCampaignParticipation.findFirst({
        where: {
          campaignId: newcomerActivity.id,
          memberId,
        },
        select: { id: true },
      });
      isNewcomer = !participation;
    }

    return {
      memberLevel: member ? String(member.levelId) : undefined,
      isNewcomer,
    };
  }

  private normalizePageParams(pageNum: number, pageSize: number): { safePageNum: number; safePageSize: number } {
    const safePageNum = Number.isFinite(pageNum) ? Math.max(1, Math.trunc(pageNum)) : 1;
    const safePageSize = Number.isFinite(pageSize) ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(pageSize))) : 20;
    return { safePageNum, safePageSize };
  }

  private async assertAggregateEnabled(tenantId: string): Promise<void> {
    const enabledRaw = await this.readSysConfigValue(tenantId, MARKETING_CLIENT_AGGREGATE_ENABLED_KEY);
    const enabled = this.parseAggregateEnabled(enabledRaw);
    BusinessException.throwIf(!enabled, '钀ラ攢鑱氬悎鍒楄〃鎺ュ彛宸插叧闂紝璇蜂娇鐢ㄥ満鏅寲鎺ュ彛');
  }

  private parseAggregateEnabled(raw: string | null): boolean {
    if (raw == null || raw.trim() === '') {
      return true;
    }
    const v = raw.trim().toUpperCase();
    if (v === 'N' || v === '0' || v === 'FALSE' || v === 'OFF') {
      return false;
    }
    return true;
  }

  private async readSysConfigValue(tenantId: string, configKey: string): Promise<string | null> {
    const baseWhere: Prisma.SysConfigWhereInput = {
      configKey,
      status: Status.NORMAL,
      delFlag: DelFlag.NORMAL,
    };

    const tenantRow = await this.prisma.sysConfig.findFirst({
      where: this.tenantHelper.readWhereForDelegate('sysConfig', {
        ...baseWhere,
        tenantId,
      }) as Prisma.SysConfigWhereInput,
    });
    if (tenantRow?.configValue != null && tenantRow.configValue.trim() !== '') {
      return tenantRow.configValue.trim();
    }

    if (tenantId === TenantHelper.SUPER_TENANT_ID) {
      return null;
    }

    const platformRow = await this.prisma.sysConfig.findFirst({
      where: {
        ...baseWhere,
        tenantId: TenantHelper.SUPER_TENANT_ID,
      },
    });
    return platformRow?.configValue?.trim() ?? null;
  }

  private formatUtcYmd(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  private async recordAggregateTraffic(tenantId: string): Promise<void> {
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const ymd = this.formatUtcYmd(todayUtc);
    const cntKey = marketingAggregateDailyCountKey(tenantId, ymd);
    const n = await this.redisService.incr(cntKey);
    if (n === 1) {
      await this.redisService.expire(cntKey, AGGREGATE_COUNT_TTL_MS);
    }
    await this.redisService.set(marketingAggregateEverUsedKey(tenantId), '1');
    await this.redisService.getClient().sadd(MARKETING_AGGREGATE_TENANT_SET_KEY, tenantId);
  }

  private async recordCompatibilityTraffic(tenantId: string): Promise<void> {
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const ymd = this.formatUtcYmd(todayUtc);
    const cntKey = marketingCompatDailyCountKey(tenantId, 'aggregate', ymd);
    const n = await this.redisService.incr(cntKey);
    if (n === 1) {
      await this.redisService.expire(cntKey, COMPAT_COUNT_TTL_MS);
    }
    await this.redisService.set(marketingCompatEverUsedKey(tenantId, 'aggregate'), '1');
    await this.redisService.getClient().sadd(MARKETING_COMPAT_TENANT_SET_KEY, tenantId);
  }
}

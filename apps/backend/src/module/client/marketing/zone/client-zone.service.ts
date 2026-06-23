import { Injectable, Logger, Optional } from '@nestjs/common';
import { DelFlag, MktCampaignStatus, PublishStatus } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityContextTokenService } from 'src/module/marketing/resolution/services/activity-context-token.service';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { Result } from 'src/common/response/result';
import type { UserMarketingContext } from 'src/module/marketing/resolution/dto/user-marketing-context.dto';
import { getErrorMessage } from 'src/common/utils/error';
import { RedisService } from 'src/module/common/redis/redis.service';
import { resolveMarketingTraceId } from 'src/module/marketing/common/trace-id.util';
import {
  MARKETING_COMPAT_TENANT_SET_KEY,
  marketingCompatDailyCountKey,
  marketingCompatEverUsedKey,
} from 'src/module/marketing/marketing-aggregate-traffic.constants';
import { ClientSceneService, type SceneModulesResult } from '../scene/client-scene.service';

export interface ClientZoneProductCard {
  productId: string;
  productName: string;
  productImg: string;
  activityContextKey: string;
  activityType: string;
  configId: string;
  activityName: string;
  displayPrice: number;
  originalPrice: number;
  status: string;
  endTime: Date | null;
}

type EligibilityHint = {
  isNewcomer?: boolean;
  memberLevel?: string;
};

const MAX_PAGE_SIZE = 50;
const COMPAT_COUNT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ZONE_SCENE_MODULE_LIMIT = 20;
const ZONE_SCENE_PRODUCT_LIMIT = 50;

@Injectable()
export class ClientZoneService {
  private readonly logger = new Logger(ClientZoneService.name);

  constructor(
    private readonly clientSceneService: ClientSceneService,
    private readonly prisma: PrismaService,
    private readonly tokenService: ActivityContextTokenService,
    private readonly redisService: RedisService,
    @Optional() private readonly cls?: ClsService,
  ) {}

  /**
   * 兼容入口仅转发 scene 主链路，不再回退 legacy zone 查询。
   */
  async getZoneProductsViaScene(
    activityType: string,
    memberId: string,
    pageNum = 1,
    pageSize = 20,
  ): Promise<Result<ClientZoneProductCard[]>> {
    const { safePageNum, safePageSize } = this.normalizePageParams(pageNum, pageSize);
    const traceId = resolveMarketingTraceId(undefined, this.cls);
    const tenantId = TenantContext.getTenantId();
    if (tenantId && tenantId !== TenantContext.SUPER_TENANT_ID) {
      void this.recordCompatibilityTraffic(tenantId).catch((error) => {
        this.logger.warn(
          `记录 zone 兼容入口调用量失败 tenant=${tenantId} traceId=${traceId}: ${getErrorMessage(error)}`,
        );
      });
    }

    const cards = await this.fetchZoneCardsViaScene(activityType, memberId, safePageNum, safePageSize, traceId);
    return Result.ok(cards);
  }

  /**
   * 鑾峰彇涓撳尯鍟嗗搧鍒楄〃锛堟寜娲诲姩绫诲瀷绛涢€夛紝鍚屼笓鍖哄唴鍚屽晢鍝佸幓閲嶏級
   *
   * @param activityType - 娲诲姩妯℃澘缂栫爜锛堜笌 storePlayConfig.templateCode 涓€鑷达級
   * @param pageNum - 椤电爜锛堜粠 1 寮€濮嬶級
   * @param pageSize - 姣忛〉鏉℃暟
   * @returns 涓撳尯鍟嗗搧鍗＄墖鍒楄〃
   */
  async getZoneProducts(activityType: string, pageNum = 1, pageSize = 20): Promise<Result<ClientZoneProductCard[]>> {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId || tenantId === TenantContext.SUPER_TENANT_ID) {
      return Result.ok([]);
    }

    const configs = await this.prisma.storePlayConfig.findMany({
      where: {
        tenantId,
        templateCode: activityType,
        status: PublishStatus.ON_SHELF,
        delFlag: DelFlag.NORMAL,
        zoneEnabled: true,
      },
      distinct: ['serviceId'],
      orderBy: { serviceId: 'asc' },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
      include: {
        targetSkus: true,
      },
    });

    if (configs.length === 0) {
      return Result.ok([]);
    }

    const productIds = configs.map((c) => c.serviceId);
    const products = await this.prisma.pmsProduct.findMany({
      where: { productId: { in: productIds }, publishStatus: PublishStatus.ON_SHELF },
      select: { productId: true, name: true, mainImages: true },
    });
    const productMap = new Map(products.map((p) => [p.productId, p]));

    const cards: ClientZoneProductCard[] = [];

    for (const config of configs) {
      const product = productMap.get(config.serviceId);
      if (!product) {
        continue;
      }
      const rules = config.rules as Record<string, unknown>;
      const activityContextKey = this.tokenService.issue({
        tenantId,
        memberId: null,
        activityType: config.templateCode,
        activityConfigId: config.id,
      });

      cards.push({
        productId: product.productId,
        productName: product.name,
        productImg: product.mainImages[0] ?? '',
        activityContextKey,
        activityType: config.templateCode,
        configId: config.id,
        activityName: (rules.activityName as string) ?? config.templateCode,
        displayPrice: Number(rules.discountPrice ?? 0),
        originalPrice: Number(rules.originalPrice ?? 0),
        status: config.status,
        endTime: rules.endTime ? new Date(rules.endTime as string) : null,
      });
    }

    return Result.ok(cards);
  }

  private async fetchZoneCardsViaScene(
    activityType: string,
    memberId: string,
    pageNum: number,
    pageSize: number,
    traceId: string,
  ): Promise<ClientZoneProductCard[]> {
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

    const sceneResult = await this.clientSceneService.getSceneModules(activityType, userContext, {
      moduleLimit: ZONE_SCENE_MODULE_LIMIT,
      productLimit: ZONE_SCENE_PRODUCT_LIMIT,
    });
    const cards = this.mapSceneModulesToZoneCards(sceneResult, activityType);
    return this.paginateCards(cards, pageNum, pageSize);
  }

  private mapSceneModulesToZoneCards(sceneResult: SceneModulesResult, activityType: string): ClientZoneProductCard[] {
    const normalizedType = activityType.trim().toUpperCase();
    const dedup = new Map<string, ClientZoneProductCard>();
    for (const module of sceneResult.modules ?? []) {
      for (const product of module.products ?? []) {
        const card = this.buildZoneCardFromSceneProduct(module, product, normalizedType);
        if (card && !dedup.has(card.productId)) {
          dedup.set(card.productId, card);
        }
      }
    }
    return [...dedup.values()];
  }

  private buildZoneCardFromSceneProduct(
    module: SceneModulesResult['modules'][number],
    product: SceneModulesResult['modules'][number]['products'][number],
    normalizedType: string,
  ): ClientZoneProductCard | null {
    const productRecord = this.toRecord(product);
    const productId = this.readString(productRecord.productId);
    if (!productId) {
      return null;
    }

    const primaryOffer = this.toRecord(productRecord.primaryOffer);
    const offerActivityType = this.readString(primaryOffer.activityType);
    if (!offerActivityType || offerActivityType.trim().toUpperCase() !== normalizedType) {
      return null;
    }

    const activityContextKey = this.readString(primaryOffer.activityContextKey);
    if (!activityContextKey) {
      return null;
    }

    const activityName = this.readString(primaryOffer.activityName) ?? module.moduleName;
    const displayPrice = this.readNumber(primaryOffer.displayPrice) ?? 0;
    const originalPrice = this.readNumber(primaryOffer.originalPrice) ?? displayPrice;
    return {
      productId,
      productName: this.readString(productRecord.productName) ?? activityName,
      productImg: this.readString(productRecord.productImg) ?? '',
      activityContextKey,
      activityType: offerActivityType,
      configId: this.readString(primaryOffer.configId) ?? `${module.moduleCode}:${productId}`,
      activityName,
      displayPrice,
      originalPrice,
      status: this.readString(primaryOffer.statusSummary) ?? PublishStatus.ON_SHELF,
      endTime: this.parseDate(this.readString(primaryOffer.countdownEndTime)),
    };
  }

  private paginateCards(cards: ClientZoneProductCard[], pageNum: number, pageSize: number): ClientZoneProductCard[] {
    const start = Math.max(0, (pageNum - 1) * pageSize);
    return cards.slice(start, start + pageSize);
  }

  private normalizePageParams(pageNum: number, pageSize: number): { safePageNum: number; safePageSize: number } {
    const safePageNum = Number.isFinite(pageNum) ? Math.max(1, Math.trunc(pageNum)) : 1;
    const safePageSize = Number.isFinite(pageSize) ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(pageSize))) : 20;
    return { safePageNum, safePageSize };
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

  private formatUtcYmd(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  private async recordCompatibilityTraffic(tenantId: string): Promise<void> {
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const ymd = this.formatUtcYmd(todayUtc);
    const cntKey = marketingCompatDailyCountKey(tenantId, 'zone', ymd);
    const n = await this.redisService.incr(cntKey);
    if (n === 1) {
      await this.redisService.expire(cntKey, COMPAT_COUNT_TTL_MS);
    }
    await this.redisService.set(marketingCompatEverUsedKey(tenantId, 'zone'), '1');
    await this.redisService.getClient().sadd(MARKETING_COMPAT_TENANT_SET_KEY, tenantId);
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
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
}

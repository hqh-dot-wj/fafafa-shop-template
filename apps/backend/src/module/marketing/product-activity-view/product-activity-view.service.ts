import { Injectable, Optional } from '@nestjs/common';
import { Result } from 'src/common/response';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { CourseGroupLifecycleService } from '../course-group/services/lifecycle.service';
import type { UserMarketingContext } from '../resolution/dto/user-marketing-context.dto';
import { ResolutionService } from '../resolution/resolution.service';
import type { ResolvedActivityContextVo } from '../resolution/vo/resolved-activity-context.vo';
import { ProductActivityViewRepository, type TenantProductRecord } from './product-activity-view.repository';
import {
  ResolutionExplainService,
  type ResolutionExplainSnapshot,
} from '../resolution/services/resolution-explain.service';
import type {
  ProductMarketingViewVo,
  MarketingOfferViewVo,
  MarketingRuntimeViewVo,
  MarketingExplainItemVo,
} from './product-marketing-view.vo';

type BaseProductActivityCard = {
  sourceType: 'SCENE' | 'CATEGORY' | 'RECOMMEND';
  sceneCode?: string;
  moduleCode?: string;
  moduleName?: string;
  productId: string;
  productName: string;
  productImg: string;
  activityContextKey: string;
  activityType: string;
  activityConfigId: string;
  displayPrice: number;
  originalPrice: number;
  activityPrice: number;
  status: string;
  tagLabel: string;
  sortScore: number;
};

@Injectable()
export class ProductActivityViewService {
  constructor(
    private readonly resolutionService: ResolutionService,
    private readonly courseGroupLifecycleService: CourseGroupLifecycleService,
    private readonly productActivityViewRepository: ProductActivityViewRepository,
    @Optional() private readonly explainService?: ResolutionExplainService,
  ) {}

  async getSceneProducts(input: {
    sceneCode: string;
    memberId: string;
    channel?: UserMarketingContext['channel'] | string;
    pageNum?: number;
    pageSize?: number;
  }) {
    const tenantId = this.resolveTenantId();
    const safeChannel = this.normalizeChannel(input.channel);
    const { pageNum, pageSize } = this.normalizePaging(input.pageNum, input.pageSize);

    const modules = await this.resolutionService.resolveSceneView({
      sceneCode: input.sceneCode,
      userContext: {
        tenantId,
        memberId: input.memberId ?? '',
        channel: safeChannel,
        now: new Date(),
        isNewcomer: false,
      },
      productLimit: pageSize,
    });

    const allCards = modules.modules.flatMap((module, moduleIndex) =>
      module.products.map((product, productIndex) =>
        this.toSceneCard({
          sceneCode: input.sceneCode,
          moduleCode: module.moduleCode,
          moduleName: module.moduleName,
          product,
          sortScore: (moduleIndex + 1) * 10000 - productIndex,
        }),
      ),
    );

    const start = (pageNum - 1) * pageSize;
    const pagedCards = allCards.slice(start, start + pageSize);
    const rows = await this.enrichRowsWithRuntime(pagedCards, tenantId, input.memberId);

    return Result.ok({
      rows,
      total: allCards.length,
      pageNum,
      pageSize,
      sceneCode: input.sceneCode,
      releaseNo: modules.releaseNo,
    });
  }

  async getCategoryProducts(input: { categoryId: number; memberId: string; pageNum?: number; pageSize?: number }) {
    const tenantId = this.resolveTenantId();
    const { pageNum, pageSize } = this.normalizePaging(input.pageNum, input.pageSize);
    const categoryId = Number(input.categoryId);
    const validCategoryId = Number.isFinite(categoryId) && categoryId > 0 ? categoryId : null;
    const [{ rows, total }, category] = await Promise.all([
      this.productActivityViewRepository.listCategoryProducts({
        tenantId,
        categoryId: validCategoryId,
        pageNum,
        pageSize,
      }),
      validCategoryId ? this.productActivityViewRepository.findCategoryById(validCategoryId) : null,
    ]);

    const baseCards = await this.toTenantProductCards(rows, tenantId, input.memberId, 'CATEGORY');
    const enrichedRows = await this.enrichRowsWithRuntime(baseCards, tenantId, input.memberId);

    return Result.ok({
      rows: enrichedRows,
      total,
      pageNum,
      pageSize,
      categoryId: Number.isFinite(categoryId) && categoryId > 0 ? categoryId : null,
      categoryName: category?.name ?? null,
    });
  }

  async getRecommendProducts(input: { memberId: string; onlyHot?: boolean; pageNum?: number; pageSize?: number }) {
    const tenantId = this.resolveTenantId();
    const { pageNum, pageSize } = this.normalizePaging(input.pageNum, input.pageSize);
    const { rows, total } = await this.productActivityViewRepository.listRecommendProducts({
      tenantId,
      onlyHot: input.onlyHot,
      pageNum,
      pageSize,
    });

    const baseCards = await this.toTenantProductCards(rows, tenantId, input.memberId, 'RECOMMEND');
    const enrichedRows = await this.enrichRowsWithRuntime(baseCards, tenantId, input.memberId);

    return Result.ok({
      rows: enrichedRows,
      total,
      pageNum,
      pageSize,
      onlyHot: input.onlyHot ?? false,
    });
  }

  async getCourseGroupRuntime(input: {
    productId: string;
    memberId?: string;
    tenantId?: string;
    activityContextKey?: string;
  }) {
    return this.courseGroupLifecycleService.getProductRuntime({
      memberId: input.memberId ?? '',
      tenantId: input.tenantId,
      productId: input.productId,
      activityContextKey: input.activityContextKey,
    });
  }

  async getProductRuntimeView(input: { productId: string; memberId: string; activityContextKey?: string }) {
    const tenantId = this.resolveTenantId();

    const [primaryActivity, courseGroupRuntime] = await Promise.all([
      this.resolutionService.resolveMainActivity({
        tenantId,
        memberId: input.memberId,
        productId: input.productId,
      }),
      this.safeGetCourseGroupRuntime({
        tenantId,
        memberId: input.memberId,
        productId: input.productId,
        activityContextKey: input.activityContextKey,
      }),
    ]);

    return Result.ok({
      productId: input.productId,
      primaryActivity: this.toPrimaryActivityView(primaryActivity),
      courseGroupRuntime,
      visible: Boolean(primaryActivity || this.readBoolean(courseGroupRuntime?.visible)),
    });
  }

  async getProductMarketingView(input: {
    productId: string;
    memberId: string;
    traceId?: string;
    activityContextKey?: string;
    includeExplain: boolean;
  }): Promise<Result<ProductMarketingViewVo>> {
    const tenantId = this.resolveTenantId();

    const [primaryActivity, courseGroupRuntime] = await Promise.all([
      this.resolutionService.resolveMainActivity({
        tenantId,
        memberId: input.memberId,
        productId: input.productId,
        traceId: input.traceId,
      }),
      this.safeGetCourseGroupRuntime({
        tenantId,
        memberId: input.memberId,
        productId: input.productId,
        activityContextKey: input.activityContextKey,
      }),
    ]);

    const visible = Boolean(primaryActivity || this.readBoolean(courseGroupRuntime?.visible));

    let explainItems: MarketingExplainItemVo[] = [];
    if (input.includeExplain && input.traceId && this.explainService) {
      const snapshot = await this.explainService.query({
        tenantId,
        traceId: input.traceId,
        productId: input.productId,
      });
      explainItems = this.toExplainItems(snapshot);
    }

    const view: ProductMarketingViewVo = {
      productId: input.productId,
      primaryOffer: primaryActivity ? this.toMarketingOfferView(primaryActivity) : null,
      secondaryOffers: [],
      runtime: courseGroupRuntime ? this.toMarketingRuntimeView(courseGroupRuntime) : null,
      visibility: {
        visible,
        reasonCode: !visible ? 'NO_ACTIVE_ACTIVITY' : undefined,
      },
      actionBar: {
        primary: this.buildPrimaryAction(primaryActivity, courseGroupRuntime),
      },
      explain: explainItems,
    };

    return Result.ok(view);
  }

  private toMarketingOfferView(activity: ResolvedActivityContextVo): MarketingOfferViewVo {
    return {
      activityType: activity.activityType,
      activityContextKey: activity.activityContextKey,
      activityName: activity.activityName,
      offerPrice: this.toNumber(activity.activityPrice),
      originalPrice: this.toNumber(activity.originalPrice),
    };
  }

  private toMarketingRuntimeView(runtime: Record<string, unknown>): MarketingRuntimeViewVo {
    const statusCode = this.readString(runtime.status) ?? 'UNKNOWN';
    return {
      activityType: this.readString(runtime.activityType) ?? 'COURSE_GROUP_BUY',
      playInstanceId: this.readString(runtime.teamId) ?? undefined,
      statusCode,
      statusText: this.readString(runtime.statusText) ?? statusCode,
    };
  }

  private buildPrimaryAction(
    activity: ResolvedActivityContextVo | null,
    courseGroupRuntime: Record<string, unknown> | null,
  ) {
    if (courseGroupRuntime) {
      const joinable = this.readBoolean(courseGroupRuntime.joinable);
      if (joinable === true) {
        return { code: 'JOIN_GROUP' as const, label: '参与拼课', enabled: true };
      }
      return { code: 'OPEN_GROUP' as const, label: '开始拼课', enabled: true };
    }
    if (activity?.activityType === 'FLASH_SALE') {
      return { code: 'FLASH_BUY' as const, label: '立即抢购', enabled: true };
    }
    return { code: 'BUY_NOW' as const, label: '立即购买', enabled: Boolean(activity) };
  }

  private toExplainItems(snapshot: ResolutionExplainSnapshot | null): MarketingExplainItemVo[] {
    if (!snapshot) return [];
    return snapshot.filtered.map((item) => ({
      domain: 'eligibility' as const,
      code: item.reason,
      message: item.reasonText,
      severity: 'WARN' as const,
    }));
  }

  private async toTenantProductCards(
    rows: TenantProductRecord[],
    tenantId: string,
    memberId: string,
    sourceType: BaseProductActivityCard['sourceType'],
  ): Promise<BaseProductActivityCard[]> {
    if (rows.length === 0) {
      return [];
    }
    const productIds = rows.map((row) => row.productId);
    const mainActivities = await this.resolutionService.resolveMainActivitiesBatch({
      tenantId,
      memberId: memberId ?? '',
      productIds,
      isNewcomer: false,
    });

    return rows.map((row, index) => {
      const activity = mainActivities.get(row.productId) ?? null;
      return this.toTenantProductCard(row, activity, sourceType, index);
    });
  }

  private toTenantProductCard(
    row: TenantProductRecord,
    activity: ResolvedActivityContextVo | null,
    sourceType: BaseProductActivityCard['sourceType'],
    index: number,
  ): BaseProductActivityCard {
    const activityPrice = this.toNumber(activity?.activityPrice);
    const originalPrice = this.toNumber(activity?.originalPrice);
    return {
      sourceType,
      productId: row.productId,
      productName: row.product?.name ?? '商品',
      productImg: row.product?.mainImages?.[0] ?? '',
      activityContextKey: activity?.activityContextKey ?? '',
      activityType: activity?.activityType ?? '',
      activityConfigId: activity?.configId ?? '',
      displayPrice: activityPrice,
      originalPrice,
      activityPrice,
      status: activity?.status ?? 'ON_SHELF',
      tagLabel: activity?.activityName ?? (row.isHot ? '推荐' : ''),
      sortScore: (row.isHot ? 100000 : 0) + (10000 - row.sort) - index,
    };
  }

  private toSceneCard(input: {
    sceneCode: string;
    moduleCode: string;
    moduleName: string;
    product: unknown;
    sortScore: number;
  }): BaseProductActivityCard {
    const record = this.toRecord(input.product);
    const primaryOffer = this.toRecord(record.primaryOffer);
    const activityPrice = this.toNumber(primaryOffer.displayPrice ?? primaryOffer.activityPrice);
    const originalPrice = this.toNumber(primaryOffer.originalPrice);

    return {
      sourceType: 'SCENE',
      sceneCode: input.sceneCode,
      moduleCode: input.moduleCode,
      moduleName: input.moduleName,
      productId: this.readString(record.productId) ?? '',
      productName: this.readString(record.productName ?? record.name) ?? '商品',
      productImg: this.readString(record.productImg ?? record.coverImage) ?? '',
      activityContextKey: this.readString(primaryOffer.activityContextKey) ?? '',
      activityType: this.readString(primaryOffer.activityType) ?? '',
      activityConfigId: this.readString(primaryOffer.configId) ?? '',
      displayPrice: activityPrice,
      originalPrice,
      activityPrice,
      status: this.readString(primaryOffer.statusSummary) ?? 'ON_SHELF',
      tagLabel: this.readString(primaryOffer.activityName) ?? this.readString(primaryOffer.activityType) ?? '',
      sortScore: input.sortScore,
    };
  }

  private async enrichRowsWithRuntime(rows: BaseProductActivityCard[], tenantId: string, memberId: string) {
    return Promise.all(
      rows.map(async (row) => {
        const runtime = await this.safeGetCourseGroupRuntime({
          tenantId,
          memberId,
          productId: row.productId,
          activityContextKey: row.activityContextKey || undefined,
        });
        const joinableTeamCount = this.countJoinableTeams(runtime);
        const courseGroupRule = this.extractRuleSummary(runtime);
        const storeMatchedVisible = this.computeStoreMatchedVisible(row.activityType, runtime);
        return {
          ...row,
          storeMatchedVisible,
          joinableTeamCount,
          ruleSummaryJson: courseGroupRule,
          courseGroupRuntime: runtime,
        };
      }),
    );
  }

  private computeStoreMatchedVisible(activityType: string, runtime: Record<string, unknown> | null): boolean {
    if (runtime) {
      const visible = this.readBoolean(runtime.visible);
      if (visible != null) {
        return visible;
      }
    }
    if (activityType.includes('COURSE_GROUP')) {
      return false;
    }
    return true;
  }

  private countJoinableTeams(runtime: Record<string, unknown> | null): number {
    if (!runtime) return 0;
    const teams = Array.isArray(runtime.teams) ? runtime.teams : [];
    return teams.reduce((count, team) => {
      const rec = this.toRecord(team);
      return count + (this.readBoolean(rec.joinable) ? 1 : 0);
    }, 0);
  }

  private extractRuleSummary(runtime: Record<string, unknown> | null) {
    if (!runtime) {
      return null;
    }
    const teams = Array.isArray(runtime.teams) ? runtime.teams : [];
    const firstTeam = teams.length > 0 ? this.toRecord(teams[0]) : null;
    if (!firstTeam) {
      return null;
    }
    return {
      minMembers: this.readNumber(firstTeam.minCount),
      maxMembers: this.readNumber(firstTeam.maxCount),
      ruleSummary: this.readString(firstTeam.ruleSummary),
      shareTitle: this.readString(firstTeam.shareTitle),
      revenueHint: this.readString(firstTeam.revenueHint),
    };
  }

  private toPrimaryActivityView(activity: ResolvedActivityContextVo | null) {
    if (!activity) {
      return null;
    }
    return {
      activityContextKey: activity.activityContextKey,
      activityType: activity.activityType,
      activityConfigId: activity.configId,
      activityName: activity.activityName,
      activityPrice: this.toNumber(activity.activityPrice),
      originalPrice: this.toNumber(activity.originalPrice),
      status: activity.status,
      startTime: activity.startTime?.toISOString() ?? null,
      endTime: activity.endTime?.toISOString() ?? null,
      remainingStock: activity.remainingStock,
      commissionMode: activity.commissionMode,
      commissionRate: this.toNumber(activity.commissionRate),
      rules: activity.rules,
    };
  }

  private async safeGetCourseGroupRuntime(input: {
    tenantId: string;
    memberId: string;
    productId: string;
    activityContextKey?: string;
  }) {
    try {
      const result = await this.courseGroupLifecycleService.getProductRuntime({
        tenantId: input.tenantId,
        memberId: input.memberId ?? '',
        productId: input.productId,
        activityContextKey: input.activityContextKey,
      });
      return this.unwrapResultData<Record<string, unknown>>(result);
    } catch {
      return null;
    }
  }

  private normalizeChannel(input?: string | UserMarketingContext['channel']): UserMarketingContext['channel'] {
    return input === 'H5' || input === 'ADMIN_PREVIEW' ? input : 'MINIAPP';
  }

  private normalizePaging(pageNumRaw?: number, pageSizeRaw?: number) {
    const pageNum = Math.max(1, Number(pageNumRaw ?? 1) || 1);
    const pageSize = Math.max(1, Math.min(50, Number(pageSizeRaw ?? 20) || 20));
    return { pageNum, pageSize };
  }

  private resolveTenantId() {
    return TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;
  }

  private unwrapResultData<T>(value: unknown): T | null {
    if (!value) return null;
    const record = value as { data?: unknown };
    return (record.data as T) ?? null;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private readBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') return true;
      if (normalized === 'false' || normalized === '0') return false;
    }
    return null;
  }

  private readNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  private toNumber(value: unknown): number {
    if (value == null) return 0;
    const maybe = this.readNumber(value);
    if (maybe != null) return maybe;
    const asObject = value as { toString?: () => string };
    if (typeof asObject?.toString === 'function') {
      const parsed = Number(asObject.toString());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return 0;
  }
}

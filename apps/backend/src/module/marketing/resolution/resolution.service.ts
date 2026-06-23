import { Injectable, Logger, Optional } from '@nestjs/common';
import { MktCampaignStatus, type StorePlayConfig } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ClsService } from 'nestjs-cls';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResolveContextDto } from './dto/resolve-context.dto';
import { ValidateActivityDto } from './dto/validate-activity.dto';
import { ResolutionRepository } from './resolution.repository';
import { CandidateLoaderService } from './services/candidate-loader.service';
import { EligibilityFilterService } from './services/eligibility-filter.service';
import { AggregateSelectorService } from './services/aggregate-selector.service';
import { ActivityContextTokenService, VerifiedActivityContextToken } from './services/activity-context-token.service';
import { ResolvedActivityContextVo } from './vo/resolved-activity-context.vo';
import { getPlayRuleSchemaMetadata } from '../play/play-rule-schema.catalog';
import { UserMarketingContext } from './dto/user-marketing-context.dto';
import { SceneReleaseRepository, type SceneReleaseSnapshot } from './scene-release.repository';
import { SceneCandidateLoaderService, ProductCandidate } from './services/scene-candidate-loader.service';
import { AudienceFilterService } from './services/audience-filter.service';
import { PrimaryOfferResolverService, ResolvedProduct } from './services/primary-offer-resolver.service';
import { ModuleRankerService } from './services/module-ranker.service';
import { ProductCardViewBuilder, ModuleView } from './services/product-card-view.builder';
import { ResolutionObservabilityService } from './resolution-observability.service';
import { ResolutionExplainService } from './services/resolution-explain.service';
import { resolveMarketingTraceId } from '../common/trace-id.util';

export interface SceneModulesResult {
  sceneCode: string;
  releaseNo: number;
  traceId: string;
  source: 'scene';
  modules: ModuleView[];
}

interface SceneModuleResolveResult {
  view: ModuleView;
  explain: Record<string, unknown>;
}

const DEFAULT_MODULE_LIMIT = 8;
const MAX_MODULE_LIMIT = 20;
const DEFAULT_PRODUCT_LIMIT = 20;
const MAX_PRODUCT_LIMIT = 50;
/** 场景模块并发裁决数，控制同一请求内并行解析的模块上限，避免数据库连接压力过大 */
const MODULE_RESOLVE_CONCURRENCY = 3;
/** 单个模块裁决超时阈值（ms），超时后降级返回空商品列表 */
const MODULE_RESOLVE_TIMEOUT_MS = 800;

/**
 * 营销裁决服务
 *
 * @description
 * 负责在运行时为商品/场景匹配最优活动配置，核心职责：
 * 1. 加载候选活动并按资格条件过滤
 * 2. 按优先级/聚合规则选出主活动
 * 3. 解析场景视图（并发加载各模块商品卡片）
 * 4. 校验并锁定活动（写入审计）
 */
@Injectable()
export class ResolutionService {
  private readonly logger = new Logger(ResolutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly candidateLoader: CandidateLoaderService,
    private readonly eligibilityFilter: EligibilityFilterService,
    private readonly aggregateSelector: AggregateSelectorService,
    private readonly tokenService: ActivityContextTokenService,
    private readonly repository: ResolutionRepository,
    private readonly sceneReleaseRepo: SceneReleaseRepository,
    private readonly sceneCandidateLoader: SceneCandidateLoaderService,
    private readonly audienceFilter: AudienceFilterService,
    private readonly primaryOfferResolver: PrimaryOfferResolverService,
    private readonly moduleRanker: ModuleRankerService,
    private readonly cardViewBuilder: ProductCardViewBuilder,
    private readonly observability: ResolutionObservabilityService,
    private readonly explainService: ResolutionExplainService,
    @Optional() private readonly cls?: ClsService,
  ) {}

  /**
   * 裁决商品的主活动：加载候选、过滤资格、按优先级选出主活动。
   *
   * @param dto - 裁决上下文（租户、商品、会员）
   * @returns 裁决后的主活动上下文；无可用活动时返回 null
   */
  async resolveMainActivity(dto: ResolveContextDto): Promise<ResolvedActivityContextVo | null> {
    const candidates = await this.candidateLoader.loadCandidates(dto.tenantId, dto.productId);
    const eligibilityCtx = await this.buildEligibilityContext(dto);
    const filterResult = this.eligibilityFilter.filterCandidates(candidates, eligibilityCtx);
    const selected = await this.aggregateSelector.selectMainActivity(dto.tenantId, filterResult.eligible);

    const traceId = resolveMarketingTraceId(dto.traceId, this.cls);
    void this.explainService.record({
      traceId,
      tenantId: dto.tenantId,
      productId: dto.productId,
      memberId: dto.memberId,
      winner: selected
        ? { configId: selected.id, templateCode: selected.templateCode, priority: selected.displayPriority }
        : null,
      filtered: filterResult.filtered,
    });

    if (!selected) return null;
    const contextToken = this.issueActivityContextToken(selected, {
      tenantId: dto.tenantId,
      memberId: dto.memberId,
      channel: 'MINIAPP',
      now: new Date(),
      isNewcomer: dto.isNewcomer ?? false,
      memberLevel: dto.memberLevel,
      entrySceneCode: dto.scene,
    });
    return this.buildResolvedContext(selected, contextToken);
  }

  /**
   * 同一租户、同一会员上下文下一批商品的主活动裁决：候选加载与优先级规则各只做一次，降低聚合页 N 次往返。
   */
  async resolveMainActivitiesBatch(params: {
    tenantId: string;
    memberId: string;
    productIds: string[];
    isNewcomer?: boolean;
    memberLevel?: string;
  }): Promise<Map<string, ResolvedActivityContextVo | null>> {
    const uniqueIds = [
      ...new Set(params.productIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)),
    ];
    const result = new Map<string, ResolvedActivityContextVo | null>();
    if (uniqueIds.length === 0) {
      return result;
    }

    const ctx = await this.buildEligibilityContext({
      tenantId: params.tenantId,
      memberId: params.memberId,
      isNewcomer: params.isNewcomer,
      memberLevel: params.memberLevel,
    });

    const candidatesByProduct = await this.candidateLoader.loadCandidatesForProducts(params.tenantId, uniqueIds);
    const eligibleByProduct = new Map<string, StorePlayConfig[]>();
    for (const productId of uniqueIds) {
      const candidates = candidatesByProduct.get(productId) ?? [];
      eligibleByProduct.set(productId, this.eligibilityFilter.filterCandidates(candidates, ctx).eligible);
    }

    const selectedByProduct = await this.aggregateSelector.selectMainActivitiesForProducts(
      params.tenantId,
      eligibleByProduct,
    );

    for (const productId of uniqueIds) {
      const selected = selectedByProduct.get(productId) ?? null;
      if (!selected) {
        result.set(productId, null);
        continue;
      }
      const contextKey = this.issueActivityContextToken(selected, {
        tenantId: params.tenantId,
        memberId: params.memberId,
        channel: 'MINIAPP',
        now: new Date(),
        isNewcomer: params.isNewcomer ?? false,
        memberLevel: params.memberLevel,
      });
      result.set(productId, this.buildResolvedContext(selected, contextKey));
    }

    return result;
  }

  /**
   * 校验并锁定活动：校验 activityContextKey 签名，确认配置存在且具备资格，并写入审计。
   *
   * @param dto - 校验参数（含 activityContextKey token）
   * @returns 校验通过的活动上下文
   * @throws BusinessException 键无效、配置不存在或不满足参与条件时抛出
   */
  async validateAndLock(dto: ValidateActivityDto): Promise<ResolvedActivityContextVo> {
    const traceId = resolveMarketingTraceId(dto.traceId, this.cls);
    const verified = this.tokenService.verify(
      dto.activityContextKey,
      {
        tenantId: dto.tenantId,
        memberId: dto.memberId,
      },
      { allowAnonymousMember: true },
    );

    const candidates = await this.candidateLoader.loadCandidates(dto.tenantId, dto.productId);
    const targetConfig = candidates.find((candidate) => candidate.id === verified.activityConfigId);
    BusinessException.throwIf(!targetConfig, '活动配置不存在或已下架');

    const { eligible } = this.eligibilityFilter.filterCandidates(
      [targetConfig],
      await this.buildEligibilityContext(dto),
    );
    BusinessException.throwIf(eligible.length === 0, '活动已失效或不满足参与条件');

    const config = eligible[0];
    await this.repository.createAudit({
      tenantId: dto.tenantId,
      productId: dto.productId,
      memberId: dto.memberId,
      scene: dto.scene ?? 'CHECKOUT_PREVIEW',
      candidateSnapshot: candidates.map((candidate) => ({ id: candidate.id, type: candidate.templateCode, traceId })),
      filteredSnapshot: [],
      selectedActivityType: config.templateCode,
      selectedConfigId: config.id,
    });

    this.logger.log(
      `[resolution.validate.ok] tenant=${dto.tenantId} product=${dto.productId} member=${dto.memberId} ` +
        `activity=${config.templateCode}:${config.id} traceId=${traceId}`,
    );

    return this.buildResolvedContext(config, dto.activityContextKey!, verified);
  }

  /**
   * 解析场景视图：加载已发布场景的模块列表，并发裁决各模块内的商品卡片。
   *
   * @description
   * - 取已发布的场景快照（releaseNo）
   * - 并发度受 MODULE_RESOLVE_CONCURRENCY 限制；单模块超时后降级返回空列表，不中断整体响应
   * - 结果写入可观测性指标（成功/失败均上报）
   *
   * @param input.sceneCode - 场景标识码
   * @param input.moduleLimit - 最多裁决的模块数量，超出时截断；缺省使用 DEFAULT_MODULE_LIMIT
   * @param input.productLimit - 单模块最多展示的商品数；缺省使用模块自身配置或 DEFAULT_PRODUCT_LIMIT
   * @param input.userContext - 用户营销上下文（租户、会员、渠道等）
   * @throws BusinessException 场景未发布时抛出
   */
  async resolveSceneView(input: {
    sceneCode: string;
    moduleLimit?: number;
    productLimit?: number;
    userContext: UserMarketingContext;
  }): Promise<SceneModulesResult> {
    const traceId = resolveMarketingTraceId(input.userContext.traceId, this.cls);
    const startedAt = Date.now();
    let releaseNo: number | undefined;
    try {
      const release = await this.sceneReleaseRepo.findPublishedRelease(
        input.sceneCode,
        input.userContext.tenantId,
        input.userContext.channel,
      );
      BusinessException.throwIfNull(release, '场景未发布');

      releaseNo = release.releaseNo;
      const safeModuleLimit = this.clampPositiveInt(input.moduleLimit, DEFAULT_MODULE_LIMIT, MAX_MODULE_LIMIT);
      const modulesToResolve = release.modules.slice(0, safeModuleLimit);
      const moduleResults = await this.mapWithConcurrency(modulesToResolve, MODULE_RESOLVE_CONCURRENCY, async (mod) => {
        try {
          return await this.resolveSingleModuleView(
            mod,
            {
              ...input.userContext,
              entrySceneCode: input.sceneCode,
              entryModuleCode: mod.moduleCode,
              cardTemplateCode: mod.cardTemplateCode,
              resolverPolicyCode: mod.resolverPolicyCode,
              resolverReleaseNo: release.releaseNo,
            },
            input.productLimit,
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.warn(`场景模块裁决降级 scene=${input.sceneCode}, module=${mod.moduleCode}: ${errorMessage}`);
          return {
            view: this.cardViewBuilder.buildModuleView(mod, []),
            explain: this.buildModuleExplainSnapshot(mod, {
              status: 'FAILED',
              failureReason: errorMessage,
              candidates: [],
              filtered: [],
              visible: [],
              resolved: [],
              ranked: [],
            }),
          };
        }
      });
      const modules = moduleResults.map((item) => item.view);
      const explainSnapshot = this.buildSceneExplainSnapshot(input.sceneCode, release.releaseNo, moduleResults);

      const emptyModuleCount = modules.reduce((count, mod) => count + (mod.products?.length ? 0 : 1), 0);

      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `[scene.resolve.ok] tenant=${input.userContext.tenantId} channel=${input.userContext.channel} ` +
          `scene=${input.sceneCode} releaseNo=${release.releaseNo} modules=${modules.length} ` +
          `durationMs=${durationMs} traceId=${traceId}`,
      );
      void this.observability.recordSceneResolve({
        tenantId: input.userContext.tenantId,
        sceneCode: input.sceneCode,
        releaseNo: release.releaseNo,
        moduleCount: modules.length,
        emptyModuleCount,
        channel: input.userContext.channel,
        durationMs,
        status: 'SUCCESS',
        traceId,
        explainSnapshot,
      });

      return { sceneCode: input.sceneCode, releaseNo: release.releaseNo, traceId, source: 'scene', modules };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      this.logger.warn(
        `[scene.resolve.fail] tenant=${input.userContext.tenantId} channel=${input.userContext.channel} ` +
          `scene=${input.sceneCode} releaseNo=${releaseNo ?? '-'} durationMs=${durationMs} traceId=${traceId}`,
      );
      void this.observability.recordSceneResolve({
        tenantId: input.userContext.tenantId,
        sceneCode: input.sceneCode,
        releaseNo,
        moduleCount: 0,
        channel: input.userContext.channel,
        durationMs,
        status: 'FAILED',
        traceId,
        explainSnapshot: {
          sceneCode: input.sceneCode,
          releaseNo,
          status: 'FAILED',
          failureReason: error instanceof Error ? error.message : String(error),
          modules: [],
        },
      });
      throw error;
    }
  }

  /** 裁决单个场景模块视图：受众过滤 → 主推商品解析 → 排序 → 构建卡片，整体受 MODULE_RESOLVE_TIMEOUT_MS 超时保护 */
  private async resolveSingleModuleView(
    mod: SceneReleaseSnapshot['modules'][number],
    userContext: UserMarketingContext,
    productLimit?: number,
  ): Promise<SceneModuleResolveResult> {
    const safeProductLimit = this.clampPositiveInt(
      productLimit,
      mod.limitSize || DEFAULT_PRODUCT_LIMIT,
      MAX_PRODUCT_LIMIT,
    );
    return this.withTimeout(
      (async () => {
        const candidates = await this.sceneCandidateLoader.load(mod, userContext);
        const { visible, filtered } = await this.audienceFilter.filter(candidates, mod.audiencePolicyCode, userContext);
        const resolved = await this.primaryOfferResolver.resolveProducts(visible, mod.resolverPolicyCode, userContext);
        const ranked = (await this.moduleRanker.rank(resolved, mod.sortPolicyCode, userContext)).slice(
          0,
          safeProductLimit,
        );
        return {
          view: this.cardViewBuilder.buildModuleView(mod, ranked),
          explain: this.buildModuleExplainSnapshot(mod, {
            status: 'SUCCESS',
            candidates,
            filtered,
            visible,
            resolved,
            ranked,
          }),
        };
      })(),
      MODULE_RESOLVE_TIMEOUT_MS,
      `模块裁决超时: ${mod.moduleCode}`,
    );
  }

  /** 汇总场景 explain 快照，供 Trace 诊断复盘候选、过滤和最终选择链路。 */
  private buildSceneExplainSnapshot(
    sceneCode: string,
    releaseNo: number,
    moduleResults: SceneModuleResolveResult[],
  ): Record<string, unknown> {
    return {
      sceneCode,
      releaseNo,
      modules: moduleResults.map((item) => item.explain),
    };
  }

  private buildModuleExplainSnapshot(
    mod: SceneReleaseSnapshot['modules'][number],
    input: {
      status: 'SUCCESS' | 'FAILED';
      failureReason?: string;
      candidates: ProductCandidate[];
      filtered: Array<ProductCandidate & { reason: string }>;
      visible: ProductCandidate[];
      resolved: ResolvedProduct[];
      ranked: ResolvedProduct[];
    },
  ): Record<string, unknown> {
    return {
      moduleCode: mod.moduleCode,
      moduleName: mod.moduleName,
      sourcePolicyCode: mod.sourcePolicyCode,
      resolverPolicyCode: mod.resolverPolicyCode,
      audiencePolicyCode: mod.audiencePolicyCode ?? null,
      sortPolicyCode: mod.sortPolicyCode ?? null,
      status: input.status,
      failureReason: input.failureReason ?? null,
      candidateSnapshot: input.candidates.map((candidate) => this.pickCandidateExplain(candidate)),
      filterReasonSnapshot: input.filtered.map((candidate) => ({
        ...this.pickCandidateExplain(candidate),
        reason: candidate.reason,
      })),
      visibleProductIds: input.visible.map((candidate) => candidate.productId),
      resolvedSnapshot: input.resolved.map((product) => this.pickResolvedProductExplain(product)),
      selectedSnapshot: input.ranked.map((product) => this.pickResolvedProductExplain(product)),
    };
  }

  private pickCandidateExplain(candidate: ProductCandidate): Record<string, unknown> {
    return {
      productId: candidate.productId,
      productName: candidate.productName ?? null,
      activityCandidates: (candidate.activityCandidates ?? []).map((activity) => ({
        configId: activity.configId,
        templateCode: activity.templateCode,
        displayPriority: activity.displayPriority,
        status: activity.status,
      })),
    };
  }

  private pickResolvedProductExplain(product: ResolvedProduct): Record<string, unknown> {
    return {
      productId: product.productId,
      productName: product.productName ?? null,
      primaryOffer: this.pickOfferExplain(product.primaryOffer),
      secondaryOfferCount: product.secondaryOffers?.length ?? 0,
      explain: Array.isArray(product.explain) ? product.explain : [],
      courseGroupJoinExplain:
        product.courseGroupJoinExplain && typeof product.courseGroupJoinExplain === 'object'
          ? product.courseGroupJoinExplain
          : null,
    };
  }

  private pickOfferExplain(offer: Record<string, unknown> | undefined): Record<string, unknown> | null {
    if (!offer) return null;
    return {
      activityContextKey: offer.activityContextKey ?? null,
      activityType: offer.activityType ?? null,
      configId: offer.configId ?? null,
      activityName: offer.activityName ?? null,
      displayPrice: offer.displayPrice ?? null,
      originalPrice: offer.originalPrice ?? null,
      statusSummary: offer.statusSummary ?? null,
    };
  }

  /** 将 value 限定在 [1, max] 范围内；非有限数值时使用 fallback */
  private clampPositiveInt(value: number | undefined, fallback: number, max: number): number {
    const candidate = Number.isFinite(value) ? Number(value) : fallback;
    return Math.min(max, Math.max(1, Math.trunc(candidate)));
  }

  /** 为任意 Promise 附加超时保护；超时后以 timeoutMessage 为 message 抛出 Error */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      });
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  /**
   * 受控并发地将 items 映射为 handler 的结果，保留原始顺序。
   * @description 使用固定数量的 worker 循环竞争下一个待处理索引，避免 Promise.all 并发无上限。
   */
  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    handler: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    if (items.length === 0) return [];
    const results = new Array<R>(items.length);
    let nextIndex = 0;
    const workerCount = Math.max(1, Math.min(concurrency, items.length));
    const workers = Array.from({ length: workerCount }, async () => {
      while (true) {
        const current = nextIndex++;
        if (current >= items.length) {
          return;
        }
        results[current] = await handler(items[current], current);
      }
    });
    await Promise.all(workers);
    return results;
  }

  /** 将 StorePlayConfig 映射为对外返回的裁决结果 VO */
  private buildResolvedContext(
    config: StorePlayConfig,
    contextKey: string,
    token?: VerifiedActivityContextToken,
  ): ResolvedActivityContextVo {
    const rules = config.rules as Record<string, unknown>;
    return {
      activityContextKey: contextKey,
      activityType: config.templateCode,
      configId: config.id,
      activityName: this.extractActivityName(rules, config.templateCode),
      activityPrice: this.extractActivityPrice(rules),
      originalPrice: this.extractOriginalPrice(rules),
      commissionMode: config.commissionMode,
      commissionRate: config.commissionRate,
      status: config.status,
      startTime: rules.startTime ? new Date(rules.startTime as string) : null,
      endTime: rules.endTime ? new Date(rules.endTime as string) : null,
      remainingStock: (rules.remainingStock as number) ?? null,
      rules,
      displayData: null,
      entrySceneCode: token?.entrySceneCode ?? null,
      entryModuleCode: token?.entryModuleCode ?? null,
      cardTemplateCode: token?.cardTemplateCode ?? null,
      resolverPolicyCode: token?.resolverPolicyCode ?? null,
      resolverReleaseNo: token?.resolverReleaseNo ?? null,
      activityVersionId: token?.activityVersionId ?? this.extractDistributionGrowthString(rules, 'activityVersionId'),
      attributionWindowMinutes:
        token?.attributionWindowMinutes ?? this.extractDistributionGrowthNumber(rules, 'attributionWindowMinutes'),
      shareChannel: token?.shareChannel ?? this.extractDistributionGrowthString(rules, 'shareChannel'),
    };
  }

  private issueActivityContextToken(config: StorePlayConfig, ctx: UserMarketingContext): string {
    const rules = config.rules as Record<string, unknown>;
    return this.tokenService.issue({
      tenantId: ctx.tenantId,
      memberId: ctx.memberId ?? null,
      activityType: config.templateCode,
      activityConfigId: config.id,
      activityVersionId: this.extractDistributionGrowthString(rules, 'activityVersionId'),
      attributionWindowMinutes: this.extractDistributionGrowthNumber(rules, 'attributionWindowMinutes'),
      shareChannel: ctx.shareChannel ?? this.extractDistributionGrowthString(rules, 'shareChannel'),
      entrySceneCode: ctx.entrySceneCode,
      entryModuleCode: ctx.entryModuleCode,
      cardTemplateCode: ctx.cardTemplateCode,
      resolverPolicyCode: ctx.resolverPolicyCode,
      resolverReleaseNo: ctx.resolverReleaseNo,
    });
  }

  private extractDistributionGrowthString(rules: Record<string, unknown>, key: string): string | null {
    const growth = this.toRecord(rules.distributionGrowth);
    const value = growth[key] ?? rules[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private extractDistributionGrowthNumber(rules: Record<string, unknown>, key: string): number | null {
    const growth = this.toRecord(rules.distributionGrowth);
    const value = growth[key] ?? rules[key];
    if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return Math.trunc(parsed);
    }
    return null;
  }

  /** 从活动规则中提取展示名称；依次尝试 name → activityName → play 元数据 → legacy 映射 → templateCode 本身 */
  private extractActivityName(rules: Record<string, unknown>, templateCode: string): string {
    if (typeof rules.name === 'string' && rules.name.trim()) return rules.name.trim();
    if (typeof rules.activityName === 'string' && rules.activityName.trim()) return rules.activityName.trim();
    const meta = getPlayRuleSchemaMetadata(templateCode);
    if (meta?.name) return meta.name;
    /** legacy templateCode → display name for codes not registered in play metadata */
    const legacyZh: Record<string, string> = {
      FLASH: '限时秒杀',
    };
    const mapped = legacyZh[templateCode];
    if (mapped) return mapped;
    return templateCode;
  }

  /** 从活动规则中按优先级提取活动价格；找不到任何价格字段时返回 0 */
  private extractActivityPrice(rules: Record<string, unknown>): Decimal {
    for (const key of ['discountPrice', 'flashPrice', 'price', 'memberPrice', 'newcomerPrice'] as const) {
      const value = rules[key];
      if (value != null) {
        return new Decimal(String(value));
      }
    }
    return new Decimal(0);
  }

  /** 从活动规则中按优先级提取原始/市场价；找不到时返回 0 */
  private extractOriginalPrice(rules: Record<string, unknown>): Decimal {
    for (const key of ['originalPrice', 'guidePrice', 'marketPrice'] as const) {
      const value = rules[key];
      if (value != null) {
        return new Decimal(String(value));
      }
    }
    return new Decimal(0);
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  /**
   * 构建资格过滤上下文。
   * @description isNewcomer/memberLevel 若调用方已知则直接使用，否则从数据库查询，避免重复查询。
   * 无会员ID时跳过数据库查询，返回最小化上下文。
   */
  private async buildEligibilityContext(dto: {
    tenantId: string;
    memberId: string;
    isNewcomer?: boolean;
    memberLevel?: string;
  }) {
    const now = new Date();
    if (!dto.memberId) {
      return {
        memberId: dto.memberId,
        now,
        isNewcomer: dto.isNewcomer,
        memberLevel: dto.memberLevel,
      };
    }

    let memberLevel = dto.memberLevel;
    if (memberLevel == null) {
      const member = await this.prisma.umsMember.findUnique({
        where: { memberId: dto.memberId },
        select: { levelId: true },
      });
      memberLevel = member ? String(member.levelId) : undefined;
    }

    let isNewcomer = dto.isNewcomer;
    if (isNewcomer == null) {
      const newcomerActivity = await this.prisma.mktCampaign.findFirst({
        where: {
          tenantId: dto.tenantId,
          type: 'NEWCOMER_EXCLUSIVE',
          status: MktCampaignStatus.PUBLISHED,
        },
        select: { id: true },
      });

      if (newcomerActivity) {
        const participation = await this.prisma.mktCampaignParticipation.findFirst({
          where: {
            campaignId: newcomerActivity.id,
            memberId: dto.memberId,
          },
          select: { id: true },
        });
        isNewcomer = !participation;
      } else {
        isNewcomer = false;
      }
    }

    return {
      memberId: dto.memberId,
      now,
      isNewcomer,
      memberLevel,
    };
  }
}

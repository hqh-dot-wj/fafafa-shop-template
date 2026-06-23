import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MktCampaignStatus, Prisma } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { TenantContext } from 'src/common/tenant';
import { PrismaService } from 'src/prisma/prisma.service';
import { MarketingEventType } from '../events/marketing-event.types';
import { normalizeMiniappRoutePath } from '../common/miniapp-route.validator';
import { ResolutionService } from '../resolution/resolution.service';
import type { UserMarketingContext } from '../resolution/dto/user-marketing-context.dto';
import { MarketingSceneRepository } from './scene.repository';
import {
  CreateSceneFromTemplateDto,
  ListSceneDto,
  ListSceneTemplateDto,
  SaveSceneDto,
  SyncSceneFromTemplateDto,
} from './dto/scene.dto';
import { ListSceneModuleDto, SaveSceneModuleDto } from './dto/scene-module.dto';
import {
  SCENE_PREVIEW_CHANNELS,
  ScenePreviewCardVo,
  ScenePreviewChannel,
  ScenePreviewQueryDto,
  ScenePreviewResultVo,
} from './dto/scene-preview.dto';

const RELEASE_STATUS_PUBLISHED = 'PUBLISHED';
const ACTIVE_STATUS = 'ACTIVE';

type SceneGraph = NonNullable<Awaited<ReturnType<MarketingSceneRepository['findSceneGraph']>>>;
type SceneTemplateGraph = Prisma.MktSceneTemplateGetPayload<{ include: { modules: true } }>;
type SceneTemplateModule = SceneTemplateGraph['modules'][number];

type PolicyRef = {
  code: string;
  expectedType: 'SOURCE' | 'RESOLVER' | 'AUDIENCE' | 'SORT' | 'CARD_TEMPLATE';
  origin: string;
};

const SCENE_TEMPLATE_SYNC_FIELDS = new Set([
  'sceneType',
  'channelScope',
  'pageRoute',
  'defaultCardTemplateCode',
  'defaultResolverPolicyCode',
  'placementConfig',
]);

const SCENE_TEMPLATE_MODULE_SYNC_FIELDS = new Set([
  'moduleName',
  'moduleType',
  'title',
  'subTitle',
  'displayOrder',
  'limitSize',
  'sourcePolicyCode',
  'resolverPolicyCode',
  'sortPolicyCode',
  'audiencePolicyCode',
  'cardTemplateCode',
  'attributionPolicyCode',
  'uiConfig',
]);

export interface ScenePublishPrecheckResult {
  pass: boolean;
  sceneCode: string;
  checkedAt: string;
  moduleCount: number;
  issues: string[];
  issueDetails: ScenePublishPrecheckIssue[];
}

export interface ScenePublishPrecheckIssue {
  code:
    | 'SCENE_INACTIVE'
    | 'SCENE_NO_ACTIVE_MODULES'
    | 'MODULE_REQUIRED_POLICY_MISSING'
    | 'MODULE_LIMIT_INVALID'
    | 'POLICY_MISSING'
    | 'POLICY_TYPE_MISMATCH'
    | 'POLICY_INACTIVE';
  level: 'ERROR';
  target: string;
  message: string;
  relatedPolicyCode?: string;
}

/**
 * 营销场景管理服务
 *
 * @description
 * 管理场景（Scene）及其模块（Module）的 CRUD、发布和发布前预检（precheck）。
 * 发布时会将场景快照持久化为 release 记录，并触发缓存失效事件。
 */
@Injectable()
export class MarketingSceneService {
  private readonly logger = new Logger(MarketingSceneService.name);

  constructor(
    private readonly repo: MarketingSceneRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly resolutionService: ResolutionService,
    private readonly prisma: PrismaService,
  ) {}

  /** 将 placement_config JSON 展开为列表列字段，供 admin 场景定义表展示 */
  private enrichSceneListRow<T extends { placementConfig?: unknown }>(row: T) {
    const raw = row.placementConfig;
    const cfg = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const pickStr = (key: string): string | undefined =>
      typeof cfg[key] === 'string' ? (cfg[key] as string) : undefined;
    return {
      ...row,
      activityTypeFilter: pickStr('activityTypeFilter'),
      storeMatchMode: pickStr('storeMatchMode'),
      sortMode: pickStr('sortMode'),
    };
  }

  /** 分页查询场景列表 */
  async list(query: ListSceneDto) {
    const { rows, total } = await this.repo.searchScenes(query);
    return { rows: rows.map((r) => this.enrichSceneListRow(r)), total };
  }

  /** 查询可用场景模板，供 admin 创建场景时选择 */
  async listTemplates(query: ListSceneTemplateDto) {
    const isActive = this.parseOptionalBoolean(query.isActive) ?? true;
    const where: Prisma.MktSceneTemplateWhereInput = {
      isActive,
      ...(query.templateCode && {
        templateCode: { contains: query.templateCode, mode: 'insensitive' },
      }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.mktSceneTemplate.findMany({
        where,
        include: { modules: { orderBy: { displayOrder: 'asc' } } },
        orderBy: { templateCode: 'asc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.mktSceneTemplate.count({ where }),
    ]);
    return { rows, total };
  }

  /** 分页查询场景模块列表 */
  async listModules(query: ListSceneModuleDto) {
    const { rows, total } = await this.repo.searchSceneModules(query);
    return { rows, total };
  }

  /** 创建或更新场景（有 id 则更新，否则创建） */
  async saveScene(dto: SaveSceneDto, operatorId: string) {
    const payload: SaveSceneDto = { ...dto };
    if (payload.pageRoute?.trim()) {
      payload.pageRoute = normalizeMiniappRoutePath(payload.pageRoute).path;
    }
    return payload.id
      ? this.repo.updateScene(payload.id, payload, operatorId)
      : this.repo.createScene(payload, operatorId);
  }

  /** 从全局模板创建租户场景和默认模块，保留空白创建路径用于高级配置 */
  async createFromTemplate(dto: CreateSceneFromTemplateDto, _operatorId: string) {
    const tenantId = TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;
    const template = await this.loadActiveTemplate(dto.templateCode);
    const overrides = this.asRecord(dto.overrides) ?? {};
    const sceneType = this.pickString(overrides.sceneType) ?? template.sceneType;
    const pageRoute = this.normalizeOptionalRoute(this.pickString(overrides.pageRoute) ?? template.pageRoute);
    const placementConfig = this.applyTemplateOverride(template.placementConfig, overrides.placementConfig);

    return this.prisma.$transaction(async (tx) => {
      const scene = await tx.mktScene.create({
        data: {
          tenantId,
          sceneCode: dto.sceneCode,
          sceneName: dto.sceneName,
          sceneType,
          channelScope: this.toJson(this.applyTemplateOverride(template.channelScope, overrides.channelScope)),
          pageRoute,
          defaultCardTemplateCode:
            this.pickString(overrides.defaultCardTemplateCode) ?? template.defaultCardTemplateCode,
          defaultResolverPolicyCode:
            this.pickString(overrides.defaultResolverPolicyCode) ?? template.defaultResolverPolicyCode,
          placementConfig: this.toNullableJson(placementConfig),
          templateCode: template.templateCode,
          templateOverrides: this.toNullableJson(Object.keys(overrides).length > 0 ? overrides : null),
          status: dto.status ?? 'DRAFT',
        },
      });

      for (const templateModule of template.modules) {
        const moduleOverrides = this.readModuleOverrides(overrides, templateModule.moduleSlot);
        await tx.mktSceneModule.create({
          data: this.buildModuleCreateData(tenantId, dto.sceneCode, templateModule, moduleOverrides),
        });
      }

      return tx.mktScene.findUnique({
        where: { id: scene.id },
        include: { modules: { orderBy: { displayOrder: 'asc' } } },
      });
    });
  }

  /** 按字段把模板配置同步回子场景草稿；已记录在 templateOverrides 的字段不会被覆盖 */
  async syncFromTemplate(sceneId: string, dto: SyncSceneFromTemplateDto, _operatorId: string) {
    const tenantId = TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;
    const fields = [...new Set(dto.fields.map((field) => field.trim()).filter(Boolean))];
    BusinessException.throwIf(fields.length === 0, '请选择要同步的模板字段');
    const invalidFields = fields.filter((field) => !this.isValidTemplateSyncField(field));
    BusinessException.throwIf(invalidFields.length > 0, `不支持的模板同步字段：${invalidFields.join(', ')}`);

    const scene = await this.prisma.mktScene.findFirst({
      where: { id: sceneId, tenantId },
      include: { modules: true },
    });
    BusinessException.throwIfNull(scene, '场景不存在');
    BusinessException.throwIf(!scene.templateCode, '场景未绑定模板，无法同步');

    const template = await this.loadActiveTemplate(scene.templateCode);
    const overriddenPaths = this.collectOverridePaths(scene.templateOverrides);
    const sceneFields = fields.filter((field) => SCENE_TEMPLATE_SYNC_FIELDS.has(field));
    const moduleFields = fields
      .filter((field) => field.startsWith('modules.*.'))
      .map((field) => field.replace('modules.*.', ''))
      .filter((field) => SCENE_TEMPLATE_MODULE_SYNC_FIELDS.has(field));
    const existingModules = new Map(scene.modules.map((module) => [module.moduleCode, module]));

    return this.prisma.$transaction(async (tx) => {
      const sceneData: Prisma.MktSceneUpdateInput = {};
      for (const field of sceneFields) {
        if (overriddenPaths.has(field)) {
          continue;
        }
        this.assignSceneTemplateField(sceneData, field, template);
      }
      if (Object.keys(sceneData).length > 0) {
        await tx.mktScene.update({ where: { id: scene.id }, data: sceneData });
      }

      for (const templateModule of template.modules) {
        const moduleCode = this.buildTemplateModuleCode(scene.sceneCode, templateModule.moduleSlot);
        const updateData: Prisma.MktSceneModuleUpdateInput = {};
        for (const field of moduleFields) {
          const overridePath = `modules.${templateModule.moduleSlot}.${field}`;
          if (overriddenPaths.has(overridePath)) {
            continue;
          }
          this.assignModuleTemplateField(updateData, field, templateModule);
        }
        if (Object.keys(updateData).length === 0) {
          continue;
        }
        const existing = existingModules.get(moduleCode);
        if (existing) {
          await tx.mktSceneModule.update({ where: { id: existing.id }, data: updateData });
        } else {
          await tx.mktSceneModule.create({
            data: this.buildModuleCreateData(tenantId, scene.sceneCode, templateModule, {}),
          });
        }
      }

      return tx.mktScene.findUnique({
        where: { id: scene.id },
        include: { modules: { orderBy: { displayOrder: 'asc' } } },
      });
    });
  }

  /** 创建或更新场景模块；会先确认场景存在 */
  async saveModule(sceneCode: string, dto: SaveSceneModuleDto, operatorId: string) {
    await this.repo.ensureSceneExists(sceneCode);
    return dto.id
      ? this.repo.updateSceneModule(dto.id, { ...dto, sceneCode }, operatorId)
      : this.repo.createSceneModule({ ...dto, sceneCode }, operatorId);
  }

  /**
   * 发布场景配置
   *
   * @param sceneCode - 场景编码
   * @param operatorId - 操作人 ID
   * @returns 发布的版本记录
   * @throws BusinessException 场景不存在或并发冲突时抛出
   */
  async publish(sceneCode: string, operatorId: string) {
    const sceneGraph = await this.repo.findSceneGraph(sceneCode);
    BusinessException.throwIfNull(sceneGraph, '场景不存在');
    const issueDetails = await this.collectPublishIssues(sceneGraph);
    const issues = issueDetails.map((item) => item.message);
    BusinessException.throwIf(issues.length > 0, `发布校验失败：${issues.join('；')}`);
    const releaseNo = await this.repo.nextReleaseNo(sceneCode);

    try {
      const release = await this.repo.createRelease({
        sceneCode,
        releaseNo,
        releaseStatus: RELEASE_STATUS_PUBLISHED,
        releaseSnapshot: sceneGraph as object,
        publishedBy: operatorId,
      });
      const tenantId = release.tenantId ?? TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;
      void this.eventEmitter.emit(MarketingEventType.SCENE_RELEASE_PUBLISHED, {
        tenantId,
        sceneCode,
        releaseNo,
        publishedBy: operatorId,
      });
      this.logger.log(`场景发布成功 tenant=${tenantId}, scene=${sceneCode}, releaseNo=${releaseNo}`);
      return release;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.warn(`Concurrent publish conflict for scene ${sceneCode}, releaseNo ${releaseNo}`);
        BusinessException.throwIf(true, '发布冲突，请勿重复点击，稍后重试');
      }
      throw error;
    }
  }

  /** 发布前预检：返回所有校验问题而不实际发布，供前端展示风险提示 */
  async precheck(sceneCode: string): Promise<ScenePublishPrecheckResult> {
    const sceneGraph = await this.repo.findSceneGraph(sceneCode);
    BusinessException.throwIfNull(sceneGraph, '场景不存在');
    const issueDetails = await this.collectPublishIssues(sceneGraph);
    const issues = issueDetails.map((item) => item.message);
    return {
      pass: issues.length === 0,
      sceneCode,
      checkedAt: new Date().toISOString(),
      moduleCount: sceneGraph.modules.length,
      issues,
      issueDetails,
    };
  }

  /** 后台场景预览：使用运营输入的会员、渠道和客户端版本构造裁决上下文，不复用 C 端登录态。 */
  async previewProducts(sceneCode: string, query: ScenePreviewQueryDto): Promise<ScenePreviewResultVo> {
    const tenantId = TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;
    const pageNum = this.clampPositiveInt(query.pageNum, 1, 1, 10_000);
    const pageSize = this.clampPositiveInt(query.pageSize, 20, 1, 50);
    const productLimit = Math.min(50, pageNum * pageSize);
    const userContext = await this.buildPreviewUserContext({
      tenantId,
      memberId: this.pickOptionalString(query.memberId) ?? '',
      channel: this.normalizePreviewChannel(query.channel),
      clientVersion: this.pickOptionalString(query.clientVersion),
    });

    const modules = await this.resolutionService.resolveSceneView({
      sceneCode,
      userContext,
      productLimit,
    });
    const cards = modules.modules.flatMap((module) =>
      module.products.map((product) => this.toPreviewCard(sceneCode, module.moduleCode, module.moduleName, product)),
    );
    const start = (pageNum - 1) * pageSize;
    return {
      rows: cards.slice(start, start + pageSize),
      total: cards.length,
      pageNum,
      pageSize,
      sceneCode,
      releaseNo: modules.releaseNo,
      traceId: modules.traceId,
    };
  }

  /**
   * 收集发布校验问题：
   * 1. 场景状态是否启用
   * 2. 是否有已启用模块
   * 3. 各模块的必填策略（source/resolver/card-template）及 limitSize 合法性
   * 4. 所有策略引用是否存在、类型是否匹配、状态是否启用
   */
  private async collectPublishIssues(sceneGraph: SceneGraph): Promise<ScenePublishPrecheckIssue[]> {
    const issues: ScenePublishPrecheckIssue[] = [];
    if (sceneGraph.status !== ACTIVE_STATUS) {
      this.appendIssue(issues, {
        code: 'SCENE_INACTIVE',
        target: `scene:${sceneGraph.sceneCode}`,
        message: '场景未启用，无法发布',
      });
    }
    if (!Array.isArray(sceneGraph.modules) || sceneGraph.modules.length === 0) {
      this.appendIssue(issues, {
        code: 'SCENE_NO_ACTIVE_MODULES',
        target: `scene:${sceneGraph.sceneCode}`,
        message: '场景下没有已启用模块，请先启用至少一个模块',
      });
      return issues;
    }
    for (const module of sceneGraph.modules) {
      const missingRequiredPolicyNames: string[] = [];
      if (!module.sourcePolicyCode?.trim()) {
        missingRequiredPolicyNames.push('source');
      }
      if (!module.resolverPolicyCode?.trim()) {
        missingRequiredPolicyNames.push('resolver');
      }
      if (!module.cardTemplateCode?.trim()) {
        missingRequiredPolicyNames.push('card-template');
      }

      if (missingRequiredPolicyNames.length > 0) {
        this.appendIssue(issues, {
          code: 'MODULE_REQUIRED_POLICY_MISSING',
          target: `module:${module.moduleCode}`,
          message: `模块 ${module.moduleCode} 缺少必要策略（${missingRequiredPolicyNames.join('/')}）`,
        });
      }
      if (module.limitSize <= 0) {
        this.appendIssue(issues, {
          code: 'MODULE_LIMIT_INVALID',
          target: `module:${module.moduleCode}`,
          message: `模块 ${module.moduleCode} 的商品上限必须大于 0`,
        });
      }
    }

    const refs = this.collectPolicyRefs(sceneGraph);
    const policies = await this.repo.findPoliciesByCodes(refs.map((ref) => ref.code));
    const policyMap = new Map(policies.map((policy) => [policy.policyCode, policy]));

    const missing: string[] = [];
    const typeMismatch: string[] = [];
    const inactive: string[] = [];

    for (const ref of refs) {
      const policy = policyMap.get(ref.code);
      if (!policy) {
        const label = `${ref.origin}:${ref.code}`;
        missing.push(label);
        this.appendIssue(issues, {
          code: 'POLICY_MISSING',
          target: ref.origin,
          relatedPolicyCode: ref.code,
          message: `缺少策略 ${label}`,
        });
        continue;
      }
      if (policy.policyType !== ref.expectedType) {
        const label = `${ref.origin}:${ref.code}(${policy.policyType}=>${ref.expectedType})`;
        typeMismatch.push(label);
        this.appendIssue(issues, {
          code: 'POLICY_TYPE_MISMATCH',
          target: ref.origin,
          relatedPolicyCode: ref.code,
          message: `策略类型不匹配 ${label}`,
        });
        continue;
      }
      if (policy.status !== ACTIVE_STATUS) {
        const label = `${ref.origin}:${ref.code}`;
        inactive.push(label);
        this.appendIssue(issues, {
          code: 'POLICY_INACTIVE',
          target: ref.origin,
          relatedPolicyCode: ref.code,
          message: `策略未启用 ${label}`,
        });
      }
    }

    if (missing.length > 0 || typeMismatch.length > 0 || inactive.length > 0) {
      this.logger.warn(
        [
          missing.length > 0 ? `missing=${this.previewList(missing)}` : '',
          typeMismatch.length > 0 ? `typeMismatch=${this.previewList(typeMismatch)}` : '',
          inactive.length > 0 ? `inactive=${this.previewList(inactive)}` : '',
        ]
          .filter(Boolean)
          .join(' | '),
      );
    }
    return issues;
  }

  /** 从场景图中收集所有策略引用（含期望类型和来源路径），用于批量校验 */
  private collectPolicyRefs(sceneGraph: SceneGraph): PolicyRef[] {
    const refs: PolicyRef[] = [];

    const push = (code: string | null | undefined, expectedType: PolicyRef['expectedType'], origin: string) => {
      const safeCode = String(code ?? '').trim();
      if (!safeCode) {
        return;
      }
      refs.push({ code: safeCode, expectedType, origin });
    };

    push(sceneGraph.defaultResolverPolicyCode, 'RESOLVER', 'scene.defaultResolverPolicyCode');
    push(sceneGraph.defaultCardTemplateCode, 'CARD_TEMPLATE', 'scene.defaultCardTemplateCode');

    for (const module of sceneGraph.modules) {
      const prefix = `module:${module.moduleCode}`;
      push(module.sourcePolicyCode, 'SOURCE', `${prefix}.sourcePolicyCode`);
      push(module.resolverPolicyCode, 'RESOLVER', `${prefix}.resolverPolicyCode`);
      push(module.cardTemplateCode, 'CARD_TEMPLATE', `${prefix}.cardTemplateCode`);
      push(module.sortPolicyCode, 'SORT', `${prefix}.sortPolicyCode`);
      push(module.audiencePolicyCode, 'AUDIENCE', `${prefix}.audiencePolicyCode`);
    }

    return refs;
  }

  private previewList(values: string[], max = 5): string {
    if (values.length <= max) {
      return values.join(', ');
    }
    const head = values.slice(0, max).join(', ');
    return `${head} 等${values.length}项`;
  }

  private async buildPreviewUserContext(input: {
    tenantId: string;
    memberId: string;
    channel: ScenePreviewChannel;
    clientVersion?: string;
  }): Promise<UserMarketingContext> {
    const ctx: UserMarketingContext = {
      tenantId: input.tenantId,
      memberId: input.memberId,
      channel: input.channel,
      now: new Date(),
      isNewcomer: false,
    };
    if (input.clientVersion) {
      ctx.clientVersion = input.clientVersion;
    }
    if (!input.memberId) {
      return ctx;
    }

    const [member, newcomerActivity] = await Promise.all([
      this.prisma.umsMember.findUnique({
        where: { memberId: input.memberId },
        select: { levelId: true },
      }),
      this.prisma.mktCampaign.findFirst({
        where: {
          tenantId: input.tenantId,
          type: 'NEWCOMER_EXCLUSIVE',
          status: MktCampaignStatus.PUBLISHED,
        },
        select: { id: true },
      }),
    ]);

    if (member) {
      ctx.memberLevel = String(member.levelId);
    }
    if (!newcomerActivity) {
      return ctx;
    }

    const participation = await this.prisma.mktCampaignParticipation.findFirst({
      where: {
        campaignId: newcomerActivity.id,
        memberId: input.memberId,
      },
      select: { id: true },
    });
    ctx.isNewcomer = !participation;
    return ctx;
  }

  private toPreviewCard(
    sceneCode: string,
    moduleCode: string,
    moduleName: string,
    product: unknown,
  ): ScenePreviewCardVo {
    const record = product && typeof product === 'object' ? (product as Record<string, unknown>) : {};
    const primaryOffer =
      record.primaryOffer && typeof record.primaryOffer === 'object'
        ? (record.primaryOffer as Record<string, unknown>)
        : {};
    return {
      sceneCode,
      moduleCode,
      moduleName,
      productId: String(record.productId ?? ''),
      productName: String(record.productName ?? record.name ?? '商品'),
      productImg: String(record.productImg ?? record.coverImage ?? ''),
      activityContextKey: String(primaryOffer.activityContextKey ?? ''),
      activityType: String(primaryOffer.activityType ?? ''),
      activityConfigId: String(primaryOffer.configId ?? ''),
      displayPrice: Number(primaryOffer.displayPrice ?? 0),
      originalPrice: Number(primaryOffer.originalPrice ?? 0),
      status: String(primaryOffer.statusSummary ?? 'ON_SHELF'),
    };
  }

  private normalizePreviewChannel(channel: string | undefined): ScenePreviewChannel {
    return SCENE_PREVIEW_CHANNELS.includes(channel as ScenePreviewChannel)
      ? (channel as ScenePreviewChannel)
      : 'ADMIN_PREVIEW';
  }

  private pickOptionalString(value: string | undefined): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private clampPositiveInt(value: number | undefined, fallback: number, min: number, max: number): number {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(parsed)));
  }

  private appendIssue(container: ScenePublishPrecheckIssue[], input: Omit<ScenePublishPrecheckIssue, 'level'>) {
    container.push({
      level: 'ERROR',
      ...input,
    });
  }

  private async loadActiveTemplate(templateCode: string): Promise<SceneTemplateGraph> {
    const template = await this.prisma.mktSceneTemplate.findUnique({
      where: { templateCode },
      include: { modules: { orderBy: { displayOrder: 'asc' } } },
    });
    BusinessException.throwIf(!template || !template.isActive, '场景模板不存在或已停用');
    BusinessException.throwIf(template.modules.length === 0, '场景模板未配置模块');
    return template;
  }

  private isValidTemplateSyncField(field: string): boolean {
    if (SCENE_TEMPLATE_SYNC_FIELDS.has(field)) {
      return true;
    }
    if (!field.startsWith('modules.*.')) {
      return false;
    }
    return SCENE_TEMPLATE_MODULE_SYNC_FIELDS.has(field.replace('modules.*.', ''));
  }

  private assignSceneTemplateField(
    data: Prisma.MktSceneUpdateInput,
    field: string,
    template: SceneTemplateGraph,
  ): void {
    if (field === 'sceneType') data.sceneType = template.sceneType;
    if (field === 'channelScope') data.channelScope = this.toJson(template.channelScope);
    if (field === 'pageRoute') data.pageRoute = template.pageRoute;
    if (field === 'defaultCardTemplateCode') data.defaultCardTemplateCode = template.defaultCardTemplateCode;
    if (field === 'defaultResolverPolicyCode') {
      data.defaultResolverPolicyCode = template.defaultResolverPolicyCode;
    }
    if (field === 'placementConfig') data.placementConfig = this.toNullableJson(template.placementConfig);
  }

  private assignModuleTemplateField(
    data: Prisma.MktSceneModuleUpdateInput,
    field: string,
    templateModule: SceneTemplateModule,
  ): void {
    if (field === 'moduleName') data.moduleName = templateModule.moduleName;
    if (field === 'moduleType') data.moduleType = templateModule.moduleType;
    if (field === 'title') data.title = templateModule.title;
    if (field === 'subTitle') data.subTitle = templateModule.subTitle;
    if (field === 'displayOrder') data.displayOrder = templateModule.displayOrder;
    if (field === 'limitSize') data.limitSize = templateModule.limitSize;
    if (field === 'sourcePolicyCode') data.sourcePolicyCode = templateModule.sourcePolicyCode;
    if (field === 'resolverPolicyCode') data.resolverPolicyCode = templateModule.resolverPolicyCode;
    if (field === 'sortPolicyCode') data.sortPolicyCode = templateModule.sortPolicyCode;
    if (field === 'audiencePolicyCode') data.audiencePolicyCode = templateModule.audiencePolicyCode;
    if (field === 'cardTemplateCode') data.cardTemplateCode = templateModule.cardTemplateCode;
    if (field === 'attributionPolicyCode') data.attributionPolicyCode = templateModule.attributionPolicyCode;
    if (field === 'uiConfig') data.uiConfig = this.toNullableJson(templateModule.uiConfig);
  }

  private buildModuleCreateData(
    tenantId: string,
    sceneCode: string,
    templateModule: SceneTemplateModule,
    overrides: Record<string, unknown>,
  ): Prisma.MktSceneModuleUncheckedCreateInput {
    return {
      tenantId,
      sceneCode,
      moduleCode: this.buildTemplateModuleCode(sceneCode, templateModule.moduleSlot),
      moduleName: this.pickString(overrides.moduleName) ?? templateModule.moduleName,
      moduleType: this.pickString(overrides.moduleType) ?? templateModule.moduleType,
      title: this.pickString(overrides.title) ?? templateModule.title,
      subTitle: this.pickString(overrides.subTitle) ?? templateModule.subTitle,
      displayOrder: this.pickNumber(overrides.displayOrder) ?? templateModule.displayOrder,
      limitSize: this.pickNumber(overrides.limitSize) ?? templateModule.limitSize,
      sourcePolicyCode: this.pickString(overrides.sourcePolicyCode) ?? templateModule.sourcePolicyCode,
      resolverPolicyCode: this.pickString(overrides.resolverPolicyCode) ?? templateModule.resolverPolicyCode,
      sortPolicyCode: this.pickString(overrides.sortPolicyCode) ?? templateModule.sortPolicyCode,
      audiencePolicyCode: this.pickString(overrides.audiencePolicyCode) ?? templateModule.audiencePolicyCode,
      cardTemplateCode: this.pickString(overrides.cardTemplateCode) ?? templateModule.cardTemplateCode,
      attributionPolicyCode: this.pickString(overrides.attributionPolicyCode) ?? templateModule.attributionPolicyCode,
      uiConfig: this.toNullableJson(this.applyTemplateOverride(templateModule.uiConfig, overrides.uiConfig)),
      status: 'ACTIVE',
    };
  }

  private buildTemplateModuleCode(sceneCode: string, moduleSlot: string): string {
    return `${sceneCode}-${moduleSlot}`;
  }

  private applyTemplateOverride(base: unknown, override: unknown): unknown {
    if (override === undefined || override === null) {
      return base;
    }
    const baseRecord = this.asRecord(base);
    const overrideRecord = this.asRecord(override);
    if (baseRecord && overrideRecord) {
      return { ...baseRecord, ...overrideRecord };
    }
    return override;
  }

  private readModuleOverrides(overrides: Record<string, unknown>, moduleSlot: string): Record<string, unknown> {
    const modules = this.asRecord(overrides.modules);
    return this.asRecord(modules?.[moduleSlot]) ?? {};
  }

  private collectOverridePaths(value: unknown, prefix = ''): Set<string> {
    const paths = new Set<string>();
    const record = this.asRecord(value);
    if (!record) {
      return paths;
    }
    for (const [key, child] of Object.entries(record)) {
      const path = prefix ? `${prefix}.${key}` : key;
      paths.add(path);
      const childPaths = this.collectOverridePaths(child, path);
      childPaths.forEach((childPath) => paths.add(childPath));
    }
    return paths;
  }

  private normalizeOptionalRoute(route: string | null | undefined): string | null {
    if (!route?.trim()) {
      return null;
    }
    return normalizeMiniappRoutePath(route).path;
  }

  private parseOptionalBoolean(value: string | undefined): boolean | undefined {
    if (value === undefined) return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  }

  private pickString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private pickNumber(value: unknown): number | null {
    if (typeof value !== 'number') return null;
    return Number.isFinite(value) ? value : null;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private toNullableJson(value: unknown): Prisma.InputJsonValue | null {
    return value == null ? null : (value as Prisma.InputJsonValue);
  }
}

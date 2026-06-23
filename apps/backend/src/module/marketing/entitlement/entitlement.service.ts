import { Injectable } from '@nestjs/common';
import { MktEntitlementPool, MktEntitlementPoolStatus, MktEntitlementPoolType } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions';
import { EntitlementDefinitionVo, EntitlementDefinitionCompileTargetsVo } from './vo/entitlement-definition.vo';
import { EntitlementCompileVo, EntitlementPoolCompileResultVo } from './vo/entitlement-compile.vo';
import { CompileEntitlementDto, CompileEntitlementPoolDto } from './dto/compile-entitlement.dto';
import { CouponPoolAdapter } from './adapters/coupon-pool.adapter';
import { ProductPoolAdapter } from './adapters/product-pool.adapter';
import { PointsPoolAdapter } from './adapters/points-pool.adapter';
import { EntitlementPoolRepository } from './entitlement-pool.repository';
import { ListEntitlementPoolDto } from './dto/list-entitlement-pool.dto';
import { CreateEntitlementPoolDto } from './dto/create-entitlement-pool.dto';
import { UpdateEntitlementPoolDto } from './dto/update-entitlement-pool.dto';
import { EntitlementPoolPageVo, EntitlementPoolVo } from './vo/entitlement-pool.vo';

const VERSION = '2026-04-19';
const POOL_TYPES = ['PRODUCT', 'COUPON', 'POINTS'] as const;

@Injectable()
export class EntitlementService {
  private readonly compileTargets: EntitlementDefinitionCompileTargetsVo & Record<string, unknown> = {
    product: {
      owner: 'pms / product-activity-view / resolution',
      runtimeArtifacts: ['product-candidate', 'activity-card', 'scene-view'],
    },
    coupon: {
      owner: 'marketing coupon',
      runtimeArtifacts: ['coupon-template', 'distribution-rule', 'claim-link'],
    },
    points: {
      owner: 'marketing points',
      runtimeArtifacts: ['points-rule', 'points-task', 'points-account'],
    },
  } as const;

  private readonly disallowedScopes = ['notification', 'share'] as const;
  private readonly disallowedTouchpoints = ['notification', 'share'];

  constructor(
    private readonly productPoolAdapter: ProductPoolAdapter,
    private readonly couponPoolAdapter: CouponPoolAdapter,
    private readonly pointsPoolAdapter: PointsPoolAdapter,
    private readonly entitlementPoolRepository: EntitlementPoolRepository,
  ) {}

  getDefinition(): EntitlementDefinitionVo {
    return {
      version: VERSION,
      poolTypes: [...POOL_TYPES],
      compileTargets: this.compileTargets,
      disallowedScopes: [...this.disallowedScopes],
    };
  }

  assertScope(input: Pick<CompileEntitlementDto, 'touchpoints'>) {
    const invalidTouchpoints = input.touchpoints.filter((item) => this.disallowedTouchpoints.includes(item));
    if (invalidTouchpoints.length > 0) {
      throw new Error('本计划不包含 notification / share 触点');
    }
  }

  async compile(input: CompileEntitlementDto): Promise<EntitlementCompileVo> {
    this.assertScope(input);

    const compileTargets = await Promise.all(input.pools.map((pool) => this.compilePool(pool)));
    const owners = [...new Set(compileTargets.map((item) => item.compileTarget.owner))];
    const riskSummary = [...new Set(compileTargets.flatMap((item) => item.riskSummary ?? []))];

    return {
      pools: compileTargets,
      owners,
      riskSummary,
    };
  }

  async listPools(query: ListEntitlementPoolDto): Promise<EntitlementPoolPageVo> {
    const page = await this.entitlementPoolRepository.search(query);
    return {
      total: page.total,
      pageNum: Number(page.pageNum || query.pageNum || 1),
      pageSize: Number(page.pageSize || query.pageSize || 10),
      pages: Number(page.pages || 0),
      rows: page.rows.map(row => this.toPoolVo(row)),
    };
  }

  async createPool(input: CreateEntitlementPoolDto, operatorId: string): Promise<EntitlementPoolVo> {
    const row = await this.entitlementPoolRepository.create({
      name: input.name.trim(),
      poolType: input.poolType,
      owner: this.resolveOwner(input.poolType),
      touchpoints: this.normalizeTouchpoints(input.touchpoints),
      sourceType: this.normalizeOptionalString(input.sourceType),
      sourceKey: this.normalizeOptionalString(input.sourceKey),
      memberId: this.normalizeOptionalString(input.memberId),
      templateId: this.normalizeOptionalString(input.templateId),
      templateName: this.normalizeOptionalString(input.templateName),
      taskId: this.normalizeOptionalString(input.taskId),
      taskName: this.normalizeOptionalString(input.taskName),
      status: MktEntitlementPoolStatus.DRAFT,
      compilePreviewJson: undefined,
      compileArtifactsJson: [],
      riskSummaryJson: [],
      createdBy: operatorId,
      updatedBy: operatorId,
    });
    return this.toPoolVo(row);
  }

  async updatePool(poolId: string, input: UpdateEntitlementPoolDto, operatorId: string): Promise<EntitlementPoolVo> {
    const existed = await this.entitlementPoolRepository.findOne({ id: poolId });
    BusinessException.throwIfNull(existed, '权益池不存在');

    const nextPoolType = (input.poolType || existed.poolType) as MktEntitlementPoolType;
    const row = await this.entitlementPoolRepository.update(poolId, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.poolType !== undefined ? { poolType: input.poolType } : {}),
      ...(input.touchpoints !== undefined ? { touchpoints: this.normalizeTouchpoints(input.touchpoints) } : {}),
      ...(input.sourceType !== undefined ? { sourceType: this.normalizeOptionalString(input.sourceType) } : {}),
      ...(input.sourceKey !== undefined ? { sourceKey: this.normalizeOptionalString(input.sourceKey) } : {}),
      ...(input.memberId !== undefined ? { memberId: this.normalizeOptionalString(input.memberId) } : {}),
      ...(input.templateId !== undefined ? { templateId: this.normalizeOptionalString(input.templateId) } : {}),
      ...(input.templateName !== undefined ? { templateName: this.normalizeOptionalString(input.templateName) } : {}),
      ...(input.taskId !== undefined ? { taskId: this.normalizeOptionalString(input.taskId) } : {}),
      ...(input.taskName !== undefined ? { taskName: this.normalizeOptionalString(input.taskName) } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.compileArtifacts !== undefined ? { compileArtifactsJson: input.compileArtifacts } : {}),
      ...(input.riskSummary !== undefined ? { riskSummaryJson: input.riskSummary } : {}),
      ...(input.compilePreview !== undefined ? { compilePreviewJson: input.compilePreview } : {}),
      ...(input.lastCompiledAt !== undefined ? { lastCompiledAt: new Date(input.lastCompiledAt) } : {}),
      owner: this.resolveOwner(nextPoolType),
      updatedBy: operatorId,
    });
    return this.toPoolVo(row);
  }

  async removePool(poolId: string): Promise<void> {
    const existed = await this.entitlementPoolRepository.findOne({ id: poolId });
    BusinessException.throwIfNull(existed, '权益池不存在');
    await this.entitlementPoolRepository.delete(poolId);
  }

  private async compilePool(input: CompileEntitlementPoolDto): Promise<EntitlementPoolCompileResultVo> {
    if (input.poolType === 'PRODUCT') {
      return this.productPoolAdapter.compile(input);
    }
    if (input.poolType === 'COUPON') {
      return this.couponPoolAdapter.compile(input);
    }
    if (input.poolType === 'POINTS') {
      return this.pointsPoolAdapter.compile(input);
    }
    throw new Error(`不支持的权益池类型: ${input.poolType}`);
  }

  private resolveOwner(poolType: MktEntitlementPoolType) {
    const key = poolType.toLowerCase();
    const target = this.compileTargets[key] as { owner?: string } | undefined;
    return target?.owner || '-';
  }

  private normalizeOptionalString(value?: string | null) {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeTouchpoints(input: string[]) {
    const deduped = [...new Set(input)];
    return deduped.filter(item => !this.disallowedTouchpoints.includes(item));
  }

  private toPoolVo(row: MktEntitlementPool): EntitlementPoolVo {
    const touchpoints = this.readStringArray(row.touchpoints);
    const compileArtifacts = this.readStringArray(row.compileArtifactsJson);
    const riskSummary = this.readStringArray(row.riskSummaryJson);
    return {
      id: row.id,
      name: row.name,
      poolType: row.poolType,
      status: row.status,
      owner: row.owner || this.resolveOwner(row.poolType),
      touchpoints,
      sourceType: row.sourceType,
      sourceKey: row.sourceKey,
      memberId: row.memberId,
      templateId: row.templateId,
      templateName: row.templateName,
      taskId: row.taskId,
      taskName: row.taskName,
      compileArtifacts,
      riskSummary,
      compilePreview: this.readObject(row.compilePreviewJson),
      updatedAt: row.updateTime.toISOString(),
      lastCompiledAt: row.lastCompiledAt?.toISOString() ?? null,
    };
  }

  private readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter(item => typeof item === 'string') as string[];
  }

  private readObject(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return value as Record<string, unknown>;
  }
}

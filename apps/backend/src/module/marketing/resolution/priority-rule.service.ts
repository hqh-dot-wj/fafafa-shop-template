import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from 'src/prisma/prisma.service';
import { Result } from 'src/common/response/result';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { MarketingEventType } from '../events/marketing-event.types';

@Injectable()
export class PriorityRuleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 查询当前租户的活动类型优先级规则列表
   *
   * @param tenantId - 租户 ID
   * @returns 按优先级降序排列的规则列表
   */
  async findAll(tenantId: string) {
    const rules = await this.prisma.mktActivityPriorityRule.findMany({
      where: { tenantId },
      orderBy: { priority: 'desc' },
    });
    return Result.ok(rules);
  }

  /**
   * 创建或更新优先级规则（按 tenantId + activityType 唯一约束 upsert）
   *
   * @param tenantId - 租户 ID
   * @param dto - 规则数据
   * @returns 创建或更新后的规则
   */
  async upsert(
    tenantId: string,
    dto: { activityType: string; priority: number; aggregateEnabled?: boolean; zoneEnabled?: boolean },
    options: { emitEvent?: boolean } = {},
  ) {
    const { emitEvent = true } = options;
    const rule = await this.prisma.mktActivityPriorityRule.upsert({
      where: { tenantId_activityType: { tenantId, activityType: dto.activityType } },
      create: { tenantId, ...dto },
      update: dto,
    });
    if (emitEvent) {
      this.emitPriorityRuleChanged(tenantId, 'UPSERT', dto.activityType);
    }
    return Result.ok(rule, '优先级规则保存成功');
  }

  /**
   * 删除优先级规则（仅删除当前租户下的规则）
   *
   * @param id - 规则 ID
   * @param tenantId - 租户 ID
   * @returns 操作结果
   * @throws BusinessException 规则不存在或不属于当前租户
   */
  async remove(id: string, tenantId: string) {
    const existing = await this.prisma.mktActivityPriorityRule.findFirst({
      where: { id, tenantId },
      select: { activityType: true },
    });
    const deleted = await this.prisma.mktActivityPriorityRule.deleteMany({
      where: { id, tenantId },
    });
    BusinessException.throwIf(deleted.count === 0, '规则不存在或无权操作');
    this.emitPriorityRuleChanged(tenantId, 'REMOVE', existing?.activityType);
    return Result.ok(null, '删除成功');
  }

  /**
   * 初始化默认优先级规则（FLASH_SALE=100, COURSE_GROUP_BUY=80, MEMBER_UPGRADE=60, NEWCOMER=50, MEMBER_PRICE=30）
   *
   * @param tenantId - 租户 ID
   * @returns 操作结果
   */
  async initDefaults(tenantId: string) {
    const defaults = [
      { activityType: 'FLASH_SALE', priority: 100 },
      { activityType: 'COURSE_GROUP_BUY', priority: 80 },
      { activityType: 'MEMBER_UPGRADE', priority: 60 },
      { activityType: 'NEWCOMER', priority: 50 },
      { activityType: 'MEMBER_PRICE', priority: 30 },
    ];
    for (const d of defaults) {
      await this.upsert(tenantId, d, { emitEvent: false });
    }
    this.emitPriorityRuleChanged(tenantId, 'INIT_DEFAULTS');
    return Result.ok(null, '默认优先级规则初始化成功');
  }

  /**
   * 将租户现有优先级规则迁移为 MktPolicy 裁决策略（LEGACY_DEFAULT）
   *
   * @param tenantId - 租户 ID
   * @returns 迁移后的策略记录
   */
  async migratePriorityRuleIntoResolverPolicy(tenantId: string) {
    const rules = await this.prisma.mktActivityPriorityRule.findMany({
      where: { tenantId },
      orderBy: { priority: 'desc' },
    });
    BusinessException.throwIf(rules.length === 0, '无可迁移的优先级规则');
    const policy = await this.prisma.mktPolicy.upsert({
      where: { tenantId_policyCode: { tenantId, policyCode: 'LEGACY_DEFAULT' } },
      create: {
        tenantId,
        policyCode: 'LEGACY_DEFAULT',
        policyName: '历史优先级迁移默认策略',
        policyType: 'RESOLVER',
        config: {
          primaryOfferTypes: rules.map((r) => r.activityType),
          conflictMatrix: {},
        },
      },
      update: {
        config: {
          primaryOfferTypes: rules.map((r) => r.activityType),
          conflictMatrix: {},
        },
      },
    });
    void this.eventEmitter.emit(MarketingEventType.POLICY_CONFIG_CHANGED, {
      tenantId,
      policyCode: 'LEGACY_DEFAULT',
      policyType: 'RESOLVER',
    });
    return policy;
  }

  private emitPriorityRuleChanged(
    tenantId: string,
    action: 'UPSERT' | 'REMOVE' | 'INIT_DEFAULTS',
    activityType?: string,
  ) {
    void this.eventEmitter.emit(MarketingEventType.PRIORITY_RULE_CHANGED, {
      tenantId,
      action,
      activityType,
    });
  }
}

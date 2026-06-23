import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Prisma, PlayInstance, StorePlayConfig, PlayInstanceStatus, PublishStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { ResponseCode } from 'src/common/response/response.interface';
import { PlayInstanceService } from '../instance/instance.service';
import { UserAssetService } from '../asset/asset.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CourseGroupBuyRulesDto, CourseGroupBuyJoinDto } from './dto/course-group-buy.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CourseGroupBuyExtensionRepository } from './course-group-buy-extension.repository';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { IdempotencyService } from '../instance/idempotency.service';
import { TeamProjectionService } from '../course-group/services/team-projection.service';
import { TeamReconcileService } from '../course-group/services/team-reconcile.service';
import { TeamStateService } from '../course-group/services/team-state.service';
import { VirtualFillService } from '../course-group/services/virtual-fill.service';
import { IncidentLevel, IncidentStatus, IncidentType, type IncidentVo } from '../resolution/vo/incident.vo';
import {
  assertStorePlaySubject,
  getPlaySubjectRules,
  IPlayHandler,
  PlayContext,
  PlaySubject,
} from './play-handler.interface';

@Injectable()
export class CourseGroupBuyService implements IPlayHandler {
  readonly code = 'COURSE_GROUP_BUY';
  private readonly teamStateService: TeamStateService;
  private readonly teamProjectionService: TeamProjectionService;
  private readonly teamReconcileService: TeamReconcileService;
  private readonly virtualFillService: VirtualFillService;

  constructor(
    @Inject(forwardRef(() => PlayInstanceService))
    private readonly instanceService: PlayInstanceService,
    private readonly assetService: UserAssetService,
    private readonly prisma: PrismaService,
    private readonly extensionRepo: CourseGroupBuyExtensionRepository,
    private readonly tenantHelper: TenantHelper,
    private readonly idempotencyService: IdempotencyService,
  ) {
    this.teamStateService = new TeamStateService();
    this.teamProjectionService = new TeamProjectionService(this.teamStateService);
    this.teamReconcileService = new TeamReconcileService(this.teamProjectionService);
    this.virtualFillService = new VirtualFillService();
  }

  /**
   * 1.1 配置校验
   */
  async validateConfig(campaign: PlaySubject): Promise<void> {
    const rules = getPlaySubjectRules(campaign);
    BusinessException.throwIf(!rules, '规则配置不能为空');

    // 使用 DTO 进行严格校验
    const rulesDto = plainToInstance(CourseGroupBuyRulesDto, rules);
    const errors = await validate(rulesDto);

    if (errors.length > 0) {
      const constraints = errors[0].constraints;
      const msg = constraints ? Object.values(constraints)[0] : '规则配置校验失败';
      throw new BusinessException(ResponseCode.PARAM_INVALID, msg);
    }

    // 额外业务逻辑校验
    if (rulesDto.maxCount !== undefined && rulesDto.maxCount < rulesDto.minCount) {
      throw new BusinessException(ResponseCode.PARAM_INVALID, '最大人数不能小于最小人数');
    }

    // 上课时间校验
    if (rulesDto.classStartTime && rulesDto.classEndTime) {
      const startTime = new Date(rulesDto.classStartTime).getTime();
      const endTime = new Date(rulesDto.classEndTime).getTime();
      if (endTime <= startTime) {
        throw new BusinessException(ResponseCode.PARAM_INVALID, '上课结束时间必须晚于开始时间');
      }
    }

    // 报名截止时间校验
    if (rulesDto.joinDeadline && rulesDto.classStartTime) {
      const joinDeadline = new Date(rulesDto.joinDeadline).getTime();
      const classStart = new Date(rulesDto.classStartTime).getTime();
      if (joinDeadline >= classStart) {
        throw new BusinessException(ResponseCode.PARAM_INVALID, '报名截止时间必须早于上课开始时间');
      }
    }
  }

  async checkEligibility(ctx: PlayContext): Promise<boolean> {
    const config = assertStorePlaySubject(ctx.campaign);
    await this.validateJoin(config, ctx.memberId, ctx.params ?? {});
    return true;
  }

  async resolvePrice(ctx: PlayContext): Promise<Decimal | null> {
    const config = assertStorePlaySubject(ctx.campaign);
    return this.calculatePrice(config, ctx.params ?? {});
  }

  async applyRewards(ctx: PlayContext): Promise<void> {
    if (!ctx.instance) return;
    await this.onPaymentSuccess(ctx.instance);
  }

  /**
   * 1. 准入校验
   */
  async validateJoin(config: StorePlayConfig, memberId: string, params: Record<string, unknown> = {}): Promise<void> {
    const rules = config.rules as Record<string, unknown>;
    const joinDto = plainToInstance(CourseGroupBuyJoinDto, params);

    // A. 报名截止时间校验
    if (rules.joinDeadline) {
      const deadline = new Date(String(rules.joinDeadline)).getTime();
      if (Date.now() > deadline) {
        throw new BusinessException(ResponseCode.BUSINESS_ERROR, '报名已截止');
      }
    }

    // B. 身份校验 (团长必须是分销员)
    const isLeader = !joinDto.groupId;

    if (isLeader && rules.leaderMustBeDistributor) {
      const member = await this.prisma.umsMember.findFirst({
        where: this.tenantHelper.readWhereForDelegate('umsMember', { memberId }) as Prisma.UmsMemberWhereInput,
      });
      if (!member || (member.levelId || 0) <= 0) {
        throw new BusinessException(ResponseCode.FORBIDDEN, '只有推广员才能发起拼团');
      }
    }

    // C. 人数校验 (参团时检查是否已满)
    if (joinDto.groupId) {
      const group = await this.instanceService.findOne(String(joinDto.groupId));
      if (group.data) {
        const data = (group.data as { instanceData?: Record<string, unknown> }).instanceData;
        const current = Number(data?.currentCount) || 0;
        const limit = Number(rules.maxCount) || 99;
        if (current >= limit) {
          throw new BusinessException(ResponseCode.BUSINESS_ERROR, '该团人员已满');
        }
      } else {
        throw new BusinessException(ResponseCode.NOT_FOUND, '拼团实例不存在');
      }
    }
  }

  /**
   * 2. 计算价格 (含团长优惠/免单)
   */
  async calculatePrice(config: StorePlayConfig, params: Record<string, unknown>): Promise<Decimal> {
    const rules = config.rules as Record<string, unknown>;
    let price = new Decimal(Number(rules.price ?? 0));

    // 优先使用 SKU 维度的配置
    if (params.skuId && Array.isArray(rules.skus)) {
      const skus = rules.skus as Array<{ skuId?: string; price?: number }>;
      const skuRule = skus.find((s) => s.skuId === params.skuId);
      if (skuRule && skuRule.price) {
        price = new Decimal(skuRule.price);
      }
    }

    // 如果是团长 (新开团)
    if (params.isLeader) {
      // 1. 团长免单
      if (rules.leaderFree) {
        return new Decimal(0);
      }

      // 2. 团长优惠券
      if (rules.leaderDiscount) {
        const discount = new Decimal(Number(rules.leaderDiscount));
        price = price.minus(discount);
      }
    }

    return price.lt(0) ? new Decimal(0) : price;
  }

  /**
   * 3. 支付成功回调
   */
  async onPaymentSuccess(instance: PlayInstance): Promise<void> {
    await this.reconcileGroupByLeader({
      leaderId: this.resolveLeaderId(instance),
      tenantId: instance.tenantId,
      reason: 'PAYMENT_SUCCESS',
    });
  }

  /**
   * 4. 状态流转钩子
   */
  async onStatusChange(instance: PlayInstance, oldStatus: string, newStatus: string): Promise<void> {
    // 如果成功，发放课程权益 (次卡)
    if (newStatus === PlayInstanceStatus.SUCCESS) {
      await this.grantCourseAsset(instance);
    }
  }

  /**
   * 5. 前端展示增强
   * @description 将 JSON 规则转换为 C 端易读的文本
   */
  async getDisplayData(ctx: PlayContext): Promise<Record<string, unknown>>;
  async getDisplayData(config: StorePlayConfig): Promise<Record<string, string>>;
  async getDisplayData(input: PlayContext | StorePlayConfig): Promise<Record<string, string>> {
    const config = 'campaign' in input ? assertStorePlaySubject(input.campaign) : input;
    const rules = config.rules as Record<string, unknown>;

    // A. 基础人数文案
    const countText = `最低${rules.minCount || 1}人 ~ 最多${rules.maxCount || 99}人`;

    // B. 课程说明文案
    let lessonSummary = '课程排期加载中';
    if (rules.totalLessons && rules.dayLessons) {
      const product = await this.prisma.pmsProduct.findFirst({
        where: { productId: config.serviceId },
      });
      const duration = product?.serviceDuration || 0;
      lessonSummary = `每期课程${rules.totalLessons}节课，一天上${rules.dayLessons}节，一次${duration}分钟`;
    }

    // C. 时间地点文案
    let scheduleText = '';
    if (rules.classStartTime && rules.classEndTime) {
      const startDate = new Date(String(rules.classStartTime)).toLocaleDateString('zh-CN');
      const endDate = new Date(String(rules.classEndTime)).toLocaleDateString('zh-CN');
      scheduleText = `上课时间：${startDate} ~ ${endDate}`;
    }

    const addressText = rules.classAddress ? `上课地址：${rules.classAddress}` : '';
    const deadlineText = rules.joinDeadline
      ? `报名截止：${new Date(String(rules.joinDeadline)).toLocaleString('zh-CN')}`
      : '长期有效';

    return {
      countText,
      lessonSummary,
      scheduleText,
      addressText,
      deadlineText,
      joinDeadlineText: deadlineText, // 兼容旧字段
    };
  }

  async reconcileGroupByLeader(input: { leaderId: string; tenantId: string; reason: string }) {
    return this.idempotencyService.withTeamLock(input.leaderId, async () => {
      const leader = await this.findLeaderInstance(input.tenantId, input.leaderId);
      if (!leader) {
        return null;
      }

      const config = await this.findCourseGroupConfig(leader.configId, input.tenantId);
      if (!config) {
        return null;
      }

      const members = await this.findGroupMembers(leader.tenantId, leader.configId, leader.id);
      const minCount = Number((config.rules as Record<string, unknown>)?.minCount ?? 2);
      const maxCount = Number((config.rules as Record<string, unknown>)?.maxCount ?? Math.max(2, minCount));

      try {
        const reconciled = this.teamReconcileService.reconcileLeaderInstanceData({
          teamId: leader.id,
          reason: input.reason,
          leaderStatus: leader.status,
          minCount,
          maxCount,
          instanceData: leader.instanceData,
          members,
        });

        await this.prisma.playInstance.update({
          where: { id: leader.id },
          data: {
            instanceData: reconciled.nextInstanceData as Prisma.InputJsonValue,
          },
        });

        for (const member of members.filter((item) => this.isPaidStatus(item.status))) {
          await this.createExtensionRecord(member as PlayInstance);
        }

        if (reconciled.projection.status.baseStatus === 'FORMED') {
          await this.finalizeGroup(leader.id, leader.tenantId);
          await this.ensureLeaderSchedules(leader.id, leader.tenantId);
        }

        return {
          projection: reconciled.projection,
          nextInstanceData: reconciled.nextInstanceData,
        };
      } catch (error) {
        await this.prisma.playInstance.update({
          where: { id: leader.id },
          data: {
            instanceData: this.teamReconcileService.appendFailureAudit({
              instanceData: leader.instanceData,
              reason: input.reason,
              message: error instanceof Error ? error.message : 'unknown reconcile error',
            }) as Prisma.InputJsonValue,
          },
        });
        throw error;
      }
    });
  }

  async autoFillLeaderGroup(input: { leaderId: string; tenantId: string; now?: Date }) {
    const leader = await this.findLeaderInstance(input.tenantId, input.leaderId);
    if (!leader) {
      return { applied: false, addedCount: 0 };
    }

    const config = await this.findCourseGroupConfig(leader.configId, input.tenantId);
    if (!config) {
      return { applied: false, addedCount: 0 };
    }

    const rules = (config.rules as Record<string, unknown>) ?? {};
    const enabled = Boolean(rules.enableVirtualFill);
    if (!enabled || !this.isWithinAutoFillWindow(rules, input.now ?? new Date())) {
      return { applied: false, addedCount: 0 };
    }

    const members = await this.findGroupMembers(leader.tenantId, leader.configId, leader.id);
    const minCount = Number(rules.minCount ?? 2);
    const maxCount = Number(rules.maxCount ?? Math.max(2, minCount));
    const projection = this.teamProjectionService.buildProjection({
      teamId: leader.id,
      leaderStatus: leader.status,
      minCount,
      maxCount,
      instanceData: leader.instanceData,
      members,
    });

    const needCount = Math.max(0, minCount - projection.counts.effectiveMemberCount);
    if (needCount <= 0) {
      return { applied: false, addedCount: 0 };
    }

    let nextInstanceData = (leader.instanceData as Record<string, unknown>) ?? {};
    for (let index = 0; index < needCount; index += 1) {
      nextInstanceData = this.virtualFillService.addVirtualFillFact(nextInstanceData, {
        virtualMemberId: `auto:${leader.id}:${index + 1}:${Date.now()}`,
        displayName: `虚拟成员${index + 1}`,
        sourceType: 'AUTO',
        createdByType: 'SYSTEM',
        createdById: 'course-group-auto-fill',
      }).nextInstanceData;
    }

    await this.prisma.playInstance.update({
      where: { id: leader.id },
      data: {
        instanceData: nextInstanceData as Prisma.InputJsonValue,
      },
    });

    await this.reconcileGroupByLeader({
      leaderId: leader.id,
      tenantId: leader.tenantId,
      reason: 'AUTO_FILL',
    });

    return {
      applied: true,
      addedCount: needCount,
    };
  }

  async manualFillLeaderGroup(input: {
    leaderId: string;
    tenantId: string;
    count?: number;
    sourceType: 'ADMIN_MANUAL' | 'LEADER_MANUAL';
    createdByType: 'ADMIN' | 'LEADER';
    createdById: string;
    reason?: string;
  }) {
    const leader = await this.findLeaderInstance(input.tenantId, input.leaderId);
    if (!leader) {
      return { applied: false, addedCount: 0 };
    }

    const config = await this.findCourseGroupConfig(leader.configId, input.tenantId);
    if (!config) {
      return { applied: false, addedCount: 0 };
    }

    const rules = (config.rules as Record<string, unknown>) ?? {};
    this.assertManualFillAllowed(rules, input.sourceType);

    const members = await this.findGroupMembers(leader.tenantId, leader.configId, leader.id);
    const minCount = Number(rules.minCount ?? 2);
    const maxCount = Number(rules.maxCount ?? Math.max(2, minCount));
    const projection = this.teamProjectionService.buildProjection({
      teamId: leader.id,
      leaderStatus: leader.status,
      minCount,
      maxCount,
      instanceData: leader.instanceData,
      members,
    });

    BusinessException.throwIf(
      projection.status.displayStatus !== 'RECRUITING',
      '当前团队已成团或进入履约阶段，不能继续人工补位',
    );

    const needCount = Math.max(0, minCount - projection.counts.effectiveMemberCount);
    if (needCount <= 0) {
      return { applied: false, addedCount: 0 };
    }

    const requestedCount = Math.max(1, Math.floor(input.count ?? needCount));
    const addCount = Math.min(needCount, requestedCount);
    let nextInstanceData = (leader.instanceData as Record<string, unknown>) ?? {};
    const activeVirtualMembers = this.virtualFillService.listActiveVirtualMembers(nextInstanceData);

    for (let index = 0; index < addCount; index += 1) {
      const serial = activeVirtualMembers.length + index + 1;
      nextInstanceData = this.virtualFillService.addVirtualFillFact(nextInstanceData, {
        virtualMemberId: `${input.sourceType.toLowerCase()}:${leader.id}:${serial}:${Date.now() + index}`,
        displayName: input.sourceType === 'ADMIN_MANUAL' ? `后台补位${serial}` : `团长补位${serial}`,
        sourceType: input.sourceType,
        createdByType: input.createdByType,
        createdById: input.createdById,
        reason: input.reason,
      }).nextInstanceData;
    }

    await this.prisma.playInstance.update({
      where: { id: leader.id },
      data: {
        instanceData: nextInstanceData as Prisma.InputJsonValue,
      },
    });

    await this.reconcileGroupByLeader({
      leaderId: leader.id,
      tenantId: leader.tenantId,
      reason: input.sourceType === 'ADMIN_MANUAL' ? 'ADMIN_MANUAL_FILL' : 'LEADER_MANUAL_FILL',
    });

    return {
      applied: true,
      addedCount: addCount,
    };
  }

  async removeVirtualFillFromLeaderGroup(input: {
    leaderId: string;
    tenantId: string;
    virtualMemberId: string;
    sourceType: 'ADMIN_MANUAL' | 'LEADER_MANUAL';
    createdByType: 'ADMIN' | 'LEADER';
    createdById: string;
    reason?: string;
  }) {
    const leader = await this.findLeaderInstance(input.tenantId, input.leaderId);
    if (!leader) {
      return { applied: false, removedVirtualMemberId: input.virtualMemberId };
    }

    const config = await this.findCourseGroupConfig(leader.configId, input.tenantId);
    if (!config) {
      return { applied: false, removedVirtualMemberId: input.virtualMemberId };
    }

    const rules = (config.rules as Record<string, unknown>) ?? {};
    this.assertManualFillAllowed(rules, input.sourceType);

    const members = await this.findGroupMembers(leader.tenantId, leader.configId, leader.id);
    const minCount = Number(rules.minCount ?? 2);
    const maxCount = Number(rules.maxCount ?? Math.max(2, minCount));
    const projection = this.teamProjectionService.buildProjection({
      teamId: leader.id,
      leaderStatus: leader.status,
      minCount,
      maxCount,
      instanceData: leader.instanceData,
      members,
    });

    BusinessException.throwIf(
      projection.status.displayStatus !== 'RECRUITING',
      '当前团队已成团或进入履约阶段，不能撤销虚拟补位',
    );

    const nextInstanceData = this.virtualFillService.removeVirtualFillFact(leader.instanceData, {
      virtualMemberId: input.virtualMemberId,
      sourceType: input.sourceType,
      createdByType: input.createdByType,
      createdById: input.createdById,
      reason: input.reason,
    }).nextInstanceData;

    await this.prisma.playInstance.update({
      where: { id: leader.id },
      data: {
        instanceData: nextInstanceData as Prisma.InputJsonValue,
      },
    });

    await this.reconcileGroupByLeader({
      leaderId: leader.id,
      tenantId: leader.tenantId,
      reason: input.sourceType === 'ADMIN_MANUAL' ? 'ADMIN_MANUAL_REMOVE' : 'LEADER_MANUAL_REMOVE',
    });

    return {
      applied: true,
      removedVirtualMemberId: input.virtualMemberId,
    };
  }

  async runAutoFillSweep(now: Date = new Date()) {
    const configs = await this.prisma.storePlayConfig.findMany({
      where: {
        templateCode: 'COURSE_GROUP_BUY',
        status: PublishStatus.ON_SHELF,
      },
      select: {
        id: true,
        tenantId: true,
        rules: true,
      },
    });

    for (const config of configs) {
      const rules = (config.rules as Record<string, unknown>) ?? {};
      if (!rules.enableVirtualFill) {
        continue;
      }
      const leaders = await this.prisma.playInstance.findMany({
        where: this.tenantHelper.readWhereForDelegate('playInstance', {
          tenantId: config.tenantId,
          configId: config.id,
          templateCode: 'COURSE_GROUP_BUY',
          instanceData: { path: ['isLeader'], equals: true },
          status: {
            in: [PlayInstanceStatus.PAID, PlayInstanceStatus.ACTIVE, PlayInstanceStatus.SUCCESS],
          },
        }) as Prisma.PlayInstanceWhereInput,
      });
      for (const leader of leaders) {
        await this.autoFillLeaderGroup({
          leaderId: leader.id,
          tenantId: config.tenantId,
          now,
        });
      }
    }
  }

  async runReconcileSweep(): Promise<IncidentVo[]> {
    const leaders = await this.prisma.playInstance.findMany({
      where: this.tenantHelper.readWhereForDelegate('playInstance', {
        templateCode: 'COURSE_GROUP_BUY',
        instanceData: { path: ['isLeader'], equals: true },
        status: {
          in: [PlayInstanceStatus.PAID, PlayInstanceStatus.ACTIVE, PlayInstanceStatus.SUCCESS],
        },
      }) as Prisma.PlayInstanceWhereInput,
      select: {
        id: true,
        tenantId: true,
      },
    });

    const incidents: IncidentVo[] = [];
    for (const leader of leaders) {
      try {
        await this.reconcileGroupByLeader({
          leaderId: leader.id,
          tenantId: leader.tenantId,
          reason: 'RECONCILE_SWEEP',
        });
      } catch (error) {
        incidents.push({
          id: `course-group:${leader.id}:${IncidentType.TEAM_EFFECT_APPLY_FAILED}`,
          tenantId: leader.tenantId,
          type: IncidentType.TEAM_EFFECT_APPLY_FAILED,
          level: IncidentLevel.HIGH,
          status: IncidentStatus.OPEN,
          title: '拼课副作用补偿失败',
          message: error instanceof Error ? error.message : '未知补偿异常',
          referenceId: leader.id,
          occurredAt: new Date().toISOString(),
        });
      }
    }

    return incidents;
  }

  // --- Private Logic ---

  private async updateProgress(instance: PlayInstance) {
    const data = instance.instanceData as Record<string, unknown>;
    const parentId = (data.parentId ?? (data.isLeader ? instance.id : null)) as string | null;
    if (!parentId) return;

    // 简单更新计数
    // 在真实业务中需加锁
    const parent = await this.prisma.playInstance.findFirst({
      where: this.tenantHelper.readWhereForDelegate('playInstance', {
        id: parentId as string,
        tenantId: instance.tenantId,
      }) as Prisma.PlayInstanceWhereInput,
    });
    if (!parent) return;

    const parentData = parent.instanceData as Record<string, unknown>;
    const newCount = Number(parentData.currentCount ?? 0) + 1;

    await this.prisma.playInstance.update({
      where: { id: parentId as string },
      data: { instanceData: { ...parentData, currentCount: newCount } as Prisma.InputJsonValue },
    });

    // 检查是否达到"最低开班人数" (minCount)
    // 注意：拼团课程可能不像普通拼团那样"满员即成团"，而是"到时间且满员才由人工或Job触发"?
    // 或者"满员自动成团"?
    // 假设: 只要达到 minCount，就可以流转为 SUCCESS (开班成功)
    const config = await this.prisma.storePlayConfig.findFirst({
      where: this.tenantHelper.readWhereForDelegate('storePlayConfig', {
        id: instance.configId,
        tenantId: instance.tenantId,
      }) as Prisma.StorePlayConfigWhereInput,
    });
    const rules = config?.rules as Record<string, unknown>;

    if (newCount >= Number(rules.minCount ?? 1)) {
      // 触发成团 -> 这里简单处理，直接把相关人员全部 SUCCESS
      await this.finalizeGroup(parentId, instance.tenantId);
    }
  }

  private async finalizeGroup(leaderId: string, tenantId: string) {
    const instances = await this.prisma.playInstance.findMany({
      where: this.tenantHelper.readWhereForDelegate('playInstance', {
        OR: [{ id: leaderId }, { instanceData: { path: ['parentId'], equals: leaderId } }],
        status: { in: [PlayInstanceStatus.PAID, PlayInstanceStatus.ACTIVE] },
        tenantId,
      }) as Prisma.PlayInstanceWhereInput,
    });

    for (const ins of instances) {
      await this.instanceService.transitStatus(ins.id, PlayInstanceStatus.SUCCESS);
    }
  }

  private async grantCourseAsset(instance: PlayInstance) {
    const config = await this.prisma.storePlayConfig.findFirst({
      where: this.tenantHelper.readWhereForDelegate('storePlayConfig', {
        id: instance.configId,
        tenantId: instance.tenantId,
      }) as Prisma.StorePlayConfigWhereInput,
    });
    const rules = config?.rules as Record<string, unknown>;

    // 发放次卡
    const totalLessons = Number(rules.totalLessons ?? 0);
    if (totalLessons > 0) {
      const validDays = Number(rules.validDays ?? 0);
      await this.assetService.grantAsset({
        tenantId: instance.tenantId,
        memberId: instance.memberId,
        instanceId: instance.id,
        configId: instance.configId,
        assetName: `课程: ${config?.id ?? ''} (${totalLessons}课时)`,
        assetType: 'TIMES_CARD',
        balance: new Decimal(totalLessons),
        initialBalance: new Decimal(totalLessons),
        status: 'UNUSED',
        expireTime: validDays > 0 ? new Date(Date.now() + validDays * 86400000) : null,
      });
    }
  }

  /**
   * 创建课程扩展记录
   * @description 仅为真实拼课实例创建课程扩展；虚拟补位不进入扩展、排课或考勤。
   */
  private async createExtensionRecord(instance: PlayInstance) {
    const config = await this.prisma.storePlayConfig.findFirst({
      where: this.tenantHelper.readWhereForDelegate('storePlayConfig', {
        id: instance.configId,
        tenantId: instance.tenantId,
      }) as Prisma.StorePlayConfigWhereInput,
    });
    const rules = config?.rules as Record<string, unknown>;
    const instanceData = instance.instanceData as Record<string, unknown>;

    // 确定团ID (团长用自己的ID，团员用parentId)
    const groupId = (instanceData.isLeader ? instance.id : instanceData.parentId) as string | undefined;
    if (!groupId) return;

    // 检查是否已存在扩展记录
    const existing = await this.extensionRepo.findByInstanceId(instance.id);
    if (existing) return;

    // 获取团长信息
    const leaderInstance = await this.prisma.playInstance.findFirst({
      where: this.tenantHelper.readWhereForDelegate('playInstance', {
        id: groupId,
        tenantId: instance.tenantId,
      }) as Prisma.PlayInstanceWhereInput,
    });
    const leaderData = leaderInstance?.instanceData as Record<string, unknown> | null;

    // 创建扩展记录
    await this.extensionRepo.create({
      tenantId: instance.tenantId,
      totalLessons: Number(rules.totalLessons ?? 0),
      completedLessons: 0,
      classAddress: String(rules.classAddress ?? ''),
      classStartTime: rules.classStartTime ? new Date(String(rules.classStartTime)) : null,
      classEndTime: rules.classEndTime ? new Date(String(rules.classEndTime)) : null,
      leaderId: String(leaderData?.memberId ?? instance.memberId),
      leaderDiscount: Number(rules.leaderDiscount ?? 0),
      instance: {
        connect: { id: instance.id },
      },
      groupId,
    });
  }

  /**
   * 为成团的课程创建排课记录
   * @description 成团后按玩法规则生成团级课程计划；当前不承载老师排班、调课或停课语义。
   */
  private async createSchedulesForGroup(leaderInstance: PlayInstance) {
    const config = await this.prisma.storePlayConfig.findFirst({
      where: this.tenantHelper.readWhereForDelegate('storePlayConfig', {
        id: leaderInstance.configId,
        tenantId: leaderInstance.tenantId,
      }) as Prisma.StorePlayConfigWhereInput,
    });
    const rules = config?.rules as Record<string, unknown>;

    // 获取团长的扩展记录
    const extension = await this.extensionRepo.findByInstanceId(leaderInstance.id);
    if (!extension) return;
    if (Array.isArray(extension.schedules) && extension.schedules.length > 0) return;

    // 如果没有配置上课时间或总课时，则不创建排课
    if (!rules.classStartTime || !rules.totalLessons) return;

    const startTime = new Date(String(rules.classStartTime));
    const totalLessons = Number(rules.totalLessons);
    const dayLessons = Number(rules.dayLessons ?? 1); // 每天上几节课
    const scheduleStartTime = this.readRuleString(rules, 'scheduleStartTime') ?? '09:00';
    const scheduleEndTime = this.readRuleString(rules, 'scheduleEndTime') ?? '17:00';
    const resourcePayload = this.buildScheduleResourcePayload(rules, extension.classAddress);

    // 生成排课记录
    const schedules: Array<{
      extensionId: string;
      tenantId: string;
      date: Date;
      startTime: string;
      endTime: string;
      lessons: number;
      status: string;
      teacherId?: string;
      teacherName?: string;
      classroomId?: string;
      classroomName?: string;
      location?: string;
      capacity?: number;
      serviceCapacity?: number;
      resourceSnapshot?: Prisma.InputJsonValue;
    }> = [];
    const currentDate = new Date(startTime);
    let remainingLessons = totalLessons;

    while (remainingLessons > 0) {
      const lessonsToday = Math.min(dayLessons, remainingLessons);

      schedules.push({
        extensionId: extension.id,
        tenantId: extension.tenantId,
        date: new Date(currentDate),
        startTime: scheduleStartTime,
        endTime: scheduleEndTime,
        lessons: lessonsToday,
        status: 'SCHEDULED',
        ...resourcePayload,
      });

      remainingLessons -= lessonsToday;
      // 下一天
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 批量创建排课记录
    if (schedules.length > 0) {
      await this.extensionRepo.createSchedules(schedules);
    }
  }

  /**
   * 获取课程排课信息
   */
  async getSchedules(instanceId: string) {
    const extension = await this.extensionRepo.findByInstanceId(instanceId);
    if (!extension) {
      throw new BusinessException(ResponseCode.NOT_FOUND, '课程扩展记录不存在');
    }

    return this.extensionRepo.findSchedulesByExtensionId(extension.id);
  }

  /**
   * 获取学员考勤信息
   */
  async getAttendances(instanceId: string) {
    const extension = await this.extensionRepo.findByInstanceId(instanceId);
    if (!extension) {
      throw new BusinessException(ResponseCode.NOT_FOUND, '课程扩展记录不存在');
    }

    return this.extensionRepo.findAttendancesByExtensionId(extension.id);
  }

  /**
   * 标记学员出勤
   */
  async markAttendance(instanceId: string, memberId: string, date: Date, remark?: string) {
    const extension = await this.extensionRepo.findByInstanceId(instanceId);
    if (!extension) {
      throw new BusinessException(ResponseCode.NOT_FOUND, '课程扩展记录不存在');
    }

    // 检查排课是否存在
    const schedule = await this.extensionRepo.findScheduleByDate(extension.id, date);
    if (!schedule) {
      throw new BusinessException(ResponseCode.NOT_FOUND, '该日期没有排课');
    }

    // 标记出勤
    return this.extensionRepo.markAttended(extension.id, memberId, date, remark);
  }

  /**
   * 获取学员出勤率
   */
  async getAttendanceRate(instanceId: string, memberId: string) {
    const extension = await this.extensionRepo.findByInstanceId(instanceId);
    if (!extension) {
      throw new BusinessException(ResponseCode.NOT_FOUND, '课程扩展记录不存在');
    }

    return this.extensionRepo.getAttendanceRate(extension.id, memberId);
  }

  private async ensureLeaderSchedules(leaderId: string, tenantId: string) {
    const leader = await this.findLeaderInstance(tenantId, leaderId);
    if (!leader) {
      return;
    }
    await this.createSchedulesForGroup(leader);
  }

  private async findLeaderInstance(tenantId: string, leaderId: string) {
    return this.prisma.playInstance.findFirst({
      where: this.tenantHelper.readWhereForDelegate('playInstance', {
        id: leaderId,
        tenantId,
        templateCode: 'COURSE_GROUP_BUY',
      }) as Prisma.PlayInstanceWhereInput,
    });
  }

  private async findCourseGroupConfig(configId: string, tenantId: string) {
    return this.prisma.storePlayConfig.findFirst({
      where: this.tenantHelper.readWhereForDelegate('storePlayConfig', {
        id: configId,
        tenantId,
      }) as Prisma.StorePlayConfigWhereInput,
    });
  }

  private async findGroupMembers(tenantId: string, configId: string, leaderId: string) {
    return this.prisma.playInstance.findMany({
      where: this.tenantHelper.readWhereForDelegate('playInstance', {
        tenantId,
        templateCode: 'COURSE_GROUP_BUY',
        configId,
        OR: [{ id: leaderId }, { instanceData: { path: ['parentId'], equals: leaderId } }],
      }) as Prisma.PlayInstanceWhereInput,
      orderBy: { createTime: 'asc' },
    });
  }

  private resolveLeaderId(instance: PlayInstance) {
    const data = (instance.instanceData as Record<string, unknown>) ?? {};
    return (data.parentId as string | undefined) ?? instance.id;
  }

  private isPaidStatus(status: PlayInstanceStatus) {
    return (
      status === PlayInstanceStatus.PAID ||
      status === PlayInstanceStatus.ACTIVE ||
      status === PlayInstanceStatus.SUCCESS
    );
  }

  private isWithinAutoFillWindow(rules: Record<string, unknown>, now: Date) {
    const joinDeadline = typeof rules.joinDeadline === 'string' ? new Date(rules.joinDeadline) : null;
    const windowMinutes = Number(rules.virtualFillWindowMinutes ?? 0);
    if (!joinDeadline || Number.isNaN(joinDeadline.getTime())) {
      return false;
    }
    if (windowMinutes <= 0) {
      return false;
    }
    const windowStart = new Date(joinDeadline.getTime() - windowMinutes * 60 * 1000);
    return now.getTime() >= windowStart.getTime() && now.getTime() <= joinDeadline.getTime();
  }

  /**
   * 排课资源快照只固化履约解释所需字段；老师/教室主数据仍由后续排班资源域承接。
   */
  private buildScheduleResourcePayload(rules: Record<string, unknown>, classAddress?: string | null) {
    const teacherId = this.readRuleString(rules, 'teacherId');
    const teacherName = this.readRuleString(rules, 'teacherName');
    const classroomId = this.readRuleString(rules, 'classroomId');
    const classroomName = this.readRuleString(rules, 'classroomName');
    const location =
      this.readRuleString(rules, 'location') ?? this.readRuleString(rules, 'classAddress') ?? classAddress ?? undefined;
    const capacity = this.readRuleNumber(rules, 'capacity') ?? this.readRuleNumber(rules, 'maxCount');
    const serviceCapacity = this.readRuleNumber(rules, 'serviceCapacity') ?? capacity;
    const resourceSnapshot = this.compactRecord({
      teacherId,
      teacherName,
      classroomId,
      classroomName,
      location,
      capacity,
      serviceCapacity,
      source: 'STORE_PLAY_RULES',
    });

    return {
      teacherId,
      teacherName,
      classroomId,
      classroomName,
      location,
      capacity,
      serviceCapacity,
      resourceSnapshot,
    };
  }

  private readRuleString(rules: Record<string, unknown>, key: string): string | undefined {
    const value = rules[key];
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private readRuleNumber(rules: Record<string, unknown>, key: string): number | undefined {
    const value = rules[key];
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
    if (!Number.isFinite(parsed)) return undefined;
    const normalized = Math.trunc(parsed);
    return normalized > 0 ? normalized : undefined;
  }

  private compactRecord(record: Record<string, string | number | undefined>): Prisma.InputJsonObject {
    return Object.fromEntries(
      Object.entries(record).filter(([, value]) => value !== undefined),
    ) as Prisma.InputJsonObject;
  }

  private assertManualFillAllowed(rules: Record<string, unknown>, sourceType: 'ADMIN_MANUAL' | 'LEADER_MANUAL') {
    BusinessException.throwIf(!rules.enableVirtualFill, '当前活动未启用虚拟补位');
    if (sourceType === 'ADMIN_MANUAL') {
      BusinessException.throwIf(!rules.allowAdminManualFill, '当前活动未开启后台人工补位');
      return;
    }
    BusinessException.throwIf(!rules.allowLeaderManualFill, '当前活动未开启团长人工补位');
  }
}

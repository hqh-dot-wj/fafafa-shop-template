import { Injectable } from '@nestjs/common';
import { PlayInstanceStatus } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { Result } from 'src/common/response';
import { PlayInstanceService } from '../../instance/instance.service';
import { ProxyOpenRepository } from '../proxy-open.repository';
import { buildActivityContextKey, readStringFromRules, unwrapResultData } from '../course-group-util';
import type { TeamSummary } from '../course-group.types';
import type { CourseGroupInstanceRecord as CourseGroupInstance } from '../team.repository';
import { CourseGroupReadService } from './read.service';

@Injectable()
export class CourseGroupLifecycleService {
  constructor(
    private readonly playInstanceService: PlayInstanceService,
    private readonly proxyOpenRepository: ProxyOpenRepository,
    private readonly readService: CourseGroupReadService,
  ) {}

  async openTeam(input: {
    memberId: string;
    tenantId?: string;
    productId: string;
    skuId?: string;
    activityContextKey?: string;
    classAddress?: string;
    classStartTime?: string;
    classEndTime?: string;
    isProxyOpen?: boolean;
  }) {
    const tenantId = this.readService.resolveTenantId(input.tenantId);
    const config = await this.readService.findCourseGroupConfigByProduct(tenantId, input.productId);
    const openPermissions = this.readService.resolveOpenPermissions(config.rules);

    if (input.isProxyOpen) {
      BusinessException.throwIf(!openPermissions.allowProxyOpen, '当前门店未开启代开团权限');
    } else {
      BusinessException.throwIf(!openPermissions.allowQualifiedUserOpen, '当前活动未开放用户开团');
    }

    const activityContextKey = input.activityContextKey ?? buildActivityContextKey(config.id);
    const classAddress = input.classAddress ?? readStringFromRules(config.rules, 'classAddress');
    const classStartTime = input.classStartTime ?? readStringFromRules(config.rules, 'classStartTime');
    const classEndTime = input.classEndTime ?? readStringFromRules(config.rules, 'classEndTime');
    const instanceData: Record<string, unknown> = {
      isLeader: true,
      parentId: null,
      productId: input.productId,
      skuId: input.skuId ?? null,
      activityContextKey,
      classAddress,
      classStartTime,
      classEndTime,
      currentCount: 1,
      quantity: 1,
      openMode: input.isProxyOpen ? 'PROXY_OPEN' : 'SELF_OPEN',
      courseGroupTeam: {
        meta: { schemaVersion: 1 },
        facts: {
          snapshot: { activityContextKey, classAddress, classStartTime, classEndTime },
          audits: {
            proxyOpen: [],
            virtualFill: [],
            runtimeTransition: [],
            reconcile: [],
            memberFailure: [],
          },
        },
      },
    };

    const created = await this.playInstanceService.create({
      tenantId,
      memberId: input.memberId,
      configId: config.id,
      templateCode: 'COURSE_GROUP_BUY',
      instanceData,
    });

    const instance = unwrapResultData<{ id: string }>(created);
    BusinessException.throwIf(!instance?.id, '开团失败');

    await this.playInstanceService.transitStatus(instance.id, PlayInstanceStatus.PAID, {
      payBypass: true,
      payRequired: false,
      paidAt: new Date().toISOString(),
    });
    await this.playInstanceService.transitStatus(instance.id, PlayInstanceStatus.ACTIVE, {
      enteredAt: new Date().toISOString(),
    });

    if (input.isProxyOpen) {
      await this.proxyOpenRepository.appendProxyOpenAudit({
        teamId: instance.id,
        tenantId,
        operatorUserId: input.memberId,
        leaderUserId: input.memberId,
        productId: input.productId,
        activityContextKey: input.activityContextKey,
      });
    }

    return Result.ok({
      teamId: instance.id,
      playInstanceId: instance.id,
      payRequired: false,
      message: input.isProxyOpen ? '代开团成功' : '开团成功',
    });
  }

  async closeTeam(input: { tenantId?: string; teamId: string }) {
    const tenantId = this.readService.resolveTenantId(input.tenantId);
    const leader = await this.readService.getTeamRepository().findLeaderTeam(tenantId, input.teamId);
    BusinessException.throwIfNull(leader, '拼课团不存在');
    const runtimeUpdatedAt = new Date().toISOString();
    if (leader!.status === PlayInstanceStatus.ACTIVE || leader!.status === PlayInstanceStatus.PAID) {
      await this.playInstanceService.transitStatus(input.teamId, PlayInstanceStatus.FAILED, {
        closedByStore: true,
        runtimeStatus: 'CLOSED',
        runtimeUpdatedAt,
      });
    } else {
      await this.readService.updateTeamRuntimeState(leader!.id, leader!.instanceData, 'CLOSED', {
        closedByStore: true,
      });
    }
    return Result.ok({ teamId: input.teamId, status: 'CLOSED', teamStatus: 'CLOSED' }, '拼课团已关闭');
  }

  async startClass(input: { teamId: string; tenantId?: string }) {
    return this.simpleRuntimeAction(
      input.teamId,
      input.tenantId,
      'IN_CLASS',
      ['FORMED', 'IN_CLASS'],
      '当前拼课团未成团',
    );
  }

  async finishClass(input: { teamId: string; tenantId?: string }) {
    return this.simpleRuntimeAction(
      input.teamId,
      input.tenantId,
      'FINISHED',
      ['IN_CLASS', 'FINISHED'],
      '当前拼课团未开始上课',
    );
  }

  async getProductRuntime(input: {
    memberId: string;
    tenantId?: string;
    productId: string;
    activityContextKey?: string;
  }) {
    const teamsResult = await this.readService.listProductTeams({
      memberId: input.memberId,
      tenantId: input.tenantId,
      productId: input.productId,
      activityContextKey: input.activityContextKey,
      pageNum: 1,
      pageSize: 3,
    });
    const payload = unwrapResultData<{
      canOpen: boolean;
      allowProxyOpen: boolean;
      activityConfigId: string;
      activityContextKey: string;
      teams: TeamSummary[];
    }>(teamsResult)!;

    return Result.ok({
      productId: input.productId,
      visible: true,
      canOpen: payload.canOpen,
      allowProxyOpen: payload.allowProxyOpen,
      activityConfigId: payload.activityConfigId,
      activityContextKey: payload.activityContextKey,
      teams: payload.teams,
    });
  }

  private async simpleRuntimeAction(
    teamId: string,
    tenantId: string | undefined,
    runtimeStatus: 'IN_CLASS' | 'FINISHED',
    allowedCurrentStatuses: string[],
    invalidMessage: string,
  ) {
    const resolvedTenantId = this.readService.resolveTenantId(tenantId);
    const leader = await this.readService.getTeamRepository().findLeaderTeam(resolvedTenantId, teamId);
    BusinessException.throwIfNull(leader, '拼课团不存在');
    const config = await this.readService.getTeamRepository().findConfigById(leader!.configId);
    BusinessException.throwIfNull(config, 'Course-group config not found');

    const members = await this.readService.findTeamMembers(resolvedTenantId, leader as CourseGroupInstance);
    const currentStatus = this.readService.buildTeamProjection(leader as CourseGroupInstance, config!, members).status
      .displayStatus;
    BusinessException.throwIf(
      !allowedCurrentStatuses.includes(currentStatus),
      `${invalidMessage}，当前状态「${currentStatus}」不允许执行该操作`,
    );

    if (currentStatus !== runtimeStatus) {
      await this.readService.updateTeamRuntimeState(leader!.id, leader!.instanceData, runtimeStatus);
    }

    return Result.ok({ teamId, teamStatus: runtimeStatus });
  }
}

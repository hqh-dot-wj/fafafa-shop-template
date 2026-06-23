import { Injectable } from '@nestjs/common';
import { PublishStatus } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { Result } from 'src/common/response';
import { readRuleNumber } from '../course-group-util';
import type { ClientTeamMemberInspect } from '../course-group.types';
import { FailureResolutionService } from './failure-resolution.service';
import { CourseGroupReadService } from './read.service';
import { TeamCourseRuntimeService } from './team-course-runtime.service';

@Injectable()
export class CourseGroupMemberService {
  constructor(
    private readonly readService: CourseGroupReadService,
    private readonly teamCourseRuntimeService: TeamCourseRuntimeService,
    private readonly failureResolutionService: FailureResolutionService,
  ) {}

  async getStoreTeamMembers(input: { tenantId?: string; teamId: string }) {
    const tenantId = this.readService.resolveTenantId(input.tenantId);
    const leader = await this.readService.getTeamRepository().findLeaderTeam(tenantId, input.teamId);
    BusinessException.throwIfNull(leader, '拼课团不存在');
    const members = await this.readService.findTeamMembers(tenantId, leader!);
    return Result.ok(await this.readService.buildMemberViews(leader!, members, 'admin'));
  }

  async getStoreTeamAttendances(input: { tenantId?: string; teamId: string }) {
    const context = await this.readService.loadTeamRuntimeContext(input);
    const attendanceMembers = await this.readService.buildAttendanceMembers(context.leader, context.members);
    return Result.ok(
      await this.teamCourseRuntimeService.listAttendances({
        tenantId: context.tenantId,
        teamId: input.teamId,
        attendanceMembers,
      }),
    );
  }

  async markStoreTeamAttendance(input: {
    tenantId?: string;
    teamId: string;
    memberId: string;
    date: string;
    remark?: string;
  }) {
    const context = await this.readService.loadTeamRuntimeContext(input);
    const attendanceMembers = await this.readService.buildAttendanceMembers(context.leader, context.members);
    const attendance = await this.teamCourseRuntimeService.markAttendance({
      tenantId: context.tenantId,
      teamId: input.teamId,
      memberId: input.memberId,
      date: input.date,
      remark: input.remark,
      attendanceMembers,
    });
    return Result.ok(attendance, '已标记到课');
  }

  async getJoinPreview(input: { memberId: string; tenantId?: string; teamId: string }) {
    const tenantId = this.readService.resolveTenantId(input.tenantId);
    const leader = await this.readService.getTeamRepository().findLeaderTeam(tenantId, input.teamId);
    BusinessException.throwIfNull(leader, '拼课团不存在');

    const config = await this.readService.getTeamRepository().findConfigById(leader!.configId);
    BusinessException.throwIfNull(config, '拼课活动配置不存在');

    const members = await this.readService.findTeamMembers(tenantId, leader!);
    const projection = this.readService.buildTeamProjection(leader!, config!, members);
    const alreadyJoined = members.some((member) => member.memberId === input.memberId);
    const teamStatus = projection.status.displayStatus;
    const joinDecision = this.readService.getTeamStateService().resolveJoinDecision({
      teamStatus,
      remainingSlots: projection.counts.remainingRealSlots,
      viewerJoined: alreadyJoined,
      activityOnShelf: config!.status === PublishStatus.ON_SHELF,
    });

    return Result.ok({
      teamId: input.teamId,
      joinable: joinDecision.joinable,
      reasonCode: joinDecision.reasonCode,
      reasonText: joinDecision.reasonText,
      joinBlockReasonCode: joinDecision.reasonCode,
      joinBlockReasonText: joinDecision.reasonText,
      payAmount: readRuleNumber(config!.rules, 'price', 0),
      originalPrice: readRuleNumber(config!.rules, 'originalPrice', readRuleNumber(config!.rules, 'price', 0)),
      activityPrice: readRuleNumber(config!.rules, 'price', 0),
      remainingSlots: projection.counts.remainingRealSlots,
      message: joinDecision.reasonText,
    });
  }

  async inspectClientTeamMember(input: {
    memberId: string;
    tenantId?: string;
    teamId: string;
    targetMemberId: string;
  }) {
    const tenantId = this.readService.resolveTenantId(input.tenantId);
    const leader = await this.readService.getTeamRepository().findLeaderTeam(tenantId, input.teamId);
    BusinessException.throwIfNull(leader, '拼课团不存在');
    BusinessException.throwIf(leader!.memberId !== input.memberId, '仅团长可查看成员补位信息');

    const members = await this.readService.findTeamMembers(tenantId, leader!);
    const memberViews = await this.readService.buildMemberViews(leader!, members, 'admin');
    const inspected = memberViews.find((member) => member.memberId === input.targetMemberId);
    BusinessException.throwIfNull(inspected, '成员不存在');

    const memberType = inspected!.memberType ?? 'REAL';
    const payload: ClientTeamMemberInspect = {
      memberId: inspected!.memberId,
      name: inspected!.name,
      role: inspected!.role,
      memberType,
      isVirtual: memberType === 'VIRTUAL',
      sourceType: inspected!.sourceType,
      participatesInOrder: inspected!.participatesInOrder ?? memberType !== 'VIRTUAL',
      participatesInAttendance: inspected!.participatesInAttendance ?? memberType !== 'VIRTUAL',
      participatesInCommission: inspected!.participatesInCommission ?? memberType !== 'VIRTUAL',
    };

    return Result.ok(payload);
  }

  async resolveMemberFailure(input: { teamId: string; memberRecordId: string; tenantId?: string; reason?: string }) {
    const tenantId = this.readService.resolveTenantId(input.tenantId);
    const member = await this.readService
      .getTeamRepository()
      .findTeamMemberRecord(tenantId, input.memberRecordId, input.teamId);
    BusinessException.throwIfNull(member, '拼课成员记录不存在');

    const resolved = await this.failureResolutionService.resolveMemberFailure({
      memberRecordId: member!.id,
      currentStatus: member!.status,
      reason: input.reason,
    });
    return Result.ok({
      memberRecordId: member!.id,
      resolved: resolved.resolved,
      transitioned: resolved.transitioned,
    });
  }
}

import { Injectable, Optional } from '@nestjs/common';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { Result } from 'src/common/response';
// 类型仅引用，避免与 CourseGroupBuyService 形成 ESM 静态循环依赖（参考根 AGENTS.md §循环依赖规避）。
// 运行时由调用方手动注入或经 DI 容器在解析时填入。
import type { CourseGroupBuyService } from '../../play/course-group-buy.service';
import { normalizeOperatorId } from '../course-group-util';
import { CourseGroupReadService } from './read.service';
import {
  type CourseGroupTeamState,
  type CourseGroupVirtualFillActorType,
  type CourseGroupVirtualFillAuditRecord,
  type CourseGroupVirtualFillSourceType,
  readCourseGroupTeamState,
  reduceActiveVirtualMembers,
  writeCourseGroupTeamState,
} from './team-projection.service';

type AddVirtualFillFactInput = {
  virtualMemberId: string;
  displayName: string;
  avatar?: string | null;
  sourceType: CourseGroupVirtualFillSourceType;
  createdByType: CourseGroupVirtualFillActorType;
  createdById: string;
  createdAt?: string;
  auditId?: string;
  reason?: string;
};

type RemoveVirtualFillFactInput = {
  virtualMemberId: string;
  sourceType: CourseGroupVirtualFillSourceType;
  createdByType: CourseGroupVirtualFillActorType;
  createdById: string;
  createdAt?: string;
  auditId?: string;
  reason?: string;
};

@Injectable()
export class VirtualFillService {
  constructor(
    @Optional() private readonly readService?: CourseGroupReadService,
    // 类型已改 type-only 导入，运行时无类引用，必须 @Optional 让 Nest 在无法解析时跳过注入；
    // 现有调用方在 CourseGroupBuyService.line48 用 `new VirtualFillService()` 也走这条 undefined 分支。
    @Optional() private readonly courseGroupBuyService?: CourseGroupBuyService,
  ) {}

  async addStoreTeamVirtualFill(input: {
    tenantId?: string;
    teamId: string;
    operatorId?: string | number;
    count?: number;
    reason?: string;
  }) {
    BusinessException.throwIf(!this.readService || !this.courseGroupBuyService, '拼课补位能力未就绪');
    const tenantId = this.readService!.resolveTenantId(input.tenantId);
    const result = await this.courseGroupBuyService!.manualFillLeaderGroup({
      leaderId: input.teamId,
      tenantId,
      count: input.count,
      sourceType: 'ADMIN_MANUAL',
      createdByType: 'ADMIN',
      createdById: normalizeOperatorId(input.operatorId, tenantId, 'admin-console'),
      reason: input.reason,
    });
    return Result.ok(
      {
        teamId: input.teamId,
        addedCount: result.addedCount,
        applied: result.applied,
      },
      result.applied ? '虚拟补位已生效' : '当前无需继续补位',
    );
  }

  async removeStoreTeamVirtualFill(input: {
    tenantId?: string;
    teamId: string;
    virtualMemberId: string;
    operatorId?: string | number;
    reason?: string;
  }) {
    BusinessException.throwIf(!this.readService || !this.courseGroupBuyService, '拼课补位能力未就绪');
    const tenantId = this.readService!.resolveTenantId(input.tenantId);
    const result = await this.courseGroupBuyService!.removeVirtualFillFromLeaderGroup({
      leaderId: input.teamId,
      tenantId,
      virtualMemberId: input.virtualMemberId,
      sourceType: 'ADMIN_MANUAL',
      createdByType: 'ADMIN',
      createdById: normalizeOperatorId(input.operatorId, tenantId, 'admin-console'),
      reason: input.reason,
    });
    return Result.ok(
      {
        teamId: input.teamId,
        virtualMemberId: result.removedVirtualMemberId,
        applied: result.applied,
      },
      '虚拟补位已撤销',
    );
  }

  addVirtualFillFact(instanceData: unknown, input: AddVirtualFillFactInput) {
    const courseGroupTeam = readCourseGroupTeamState(instanceData);
    const activeMembers = reduceActiveVirtualMembers(courseGroupTeam.facts.audits.virtualFill);

    BusinessException.throwIf(
      activeMembers.some((member) => member.virtualMemberId === input.virtualMemberId),
      '虚拟补位成员已存在',
    );

    const record: CourseGroupVirtualFillAuditRecord = {
      auditId: input.auditId ?? `virtual-fill:add:${input.virtualMemberId}:${Date.now()}`,
      opType: 'ADD',
      virtualMemberId: input.virtualMemberId,
      displayName: input.displayName,
      avatar: input.avatar ?? null,
      sourceType: input.sourceType,
      createdByType: input.createdByType,
      createdById: input.createdById,
      createdAt: input.createdAt ?? new Date().toISOString(),
      reason: input.reason,
    };

    const nextCourseGroupTeam = this.withVirtualFillAudits(courseGroupTeam, [
      ...courseGroupTeam.facts.audits.virtualFill,
      record,
    ]);

    return {
      record,
      audits: nextCourseGroupTeam.facts.audits.virtualFill,
      nextInstanceData: writeCourseGroupTeamState(instanceData, nextCourseGroupTeam),
    };
  }

  removeVirtualFillFact(instanceData: unknown, input: RemoveVirtualFillFactInput) {
    const courseGroupTeam = readCourseGroupTeamState(instanceData);
    const activeMembers = reduceActiveVirtualMembers(courseGroupTeam.facts.audits.virtualFill);
    const activeMember = activeMembers.find((member) => member.virtualMemberId === input.virtualMemberId);

    BusinessException.throwIf(!activeMember, '虚拟补位成员不存在或已移除');

    const record: CourseGroupVirtualFillAuditRecord = {
      auditId: input.auditId ?? `virtual-fill:remove:${input.virtualMemberId}:${Date.now()}`,
      opType: 'REMOVE',
      virtualMemberId: input.virtualMemberId,
      displayName: activeMember?.displayName,
      avatar: activeMember?.avatar ?? null,
      sourceType: input.sourceType,
      createdByType: input.createdByType,
      createdById: input.createdById,
      createdAt: input.createdAt ?? new Date().toISOString(),
      reason: input.reason,
    };

    const nextCourseGroupTeam = this.withVirtualFillAudits(courseGroupTeam, [
      ...courseGroupTeam.facts.audits.virtualFill,
      record,
    ]);

    return {
      record,
      audits: nextCourseGroupTeam.facts.audits.virtualFill,
      nextInstanceData: writeCourseGroupTeamState(instanceData, nextCourseGroupTeam),
    };
  }

  listActiveVirtualMembers(instanceData: unknown) {
    return reduceActiveVirtualMembers(readCourseGroupTeamState(instanceData).facts.audits.virtualFill);
  }

  private withVirtualFillAudits(courseGroupTeam: CourseGroupTeamState, audits: CourseGroupVirtualFillAuditRecord[]) {
    return {
      ...courseGroupTeam,
      facts: {
        ...courseGroupTeam.facts,
        audits: {
          ...courseGroupTeam.facts.audits,
          virtualFill: audits,
        },
      },
    };
  }
}

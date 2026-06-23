import { Injectable } from '@nestjs/common';
import { CourseAttendance, CourseGroupBuyExtension, CourseSchedule } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { ResponseCode } from 'src/common/response';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { CourseGroupBuyExtensionRepository } from '../../play/course-group-buy-extension.repository';

export type TeamCourseRuntimeMember = {
  memberId: string;
  name: string;
  mobile?: string;
};

export type CourseGroupTeamCourseSummary = {
  teamId: string;
  leaderInstanceId: string;
  extensionReady: boolean;
  extensionId?: string;
  extensionStatus?: string;
  totalLessons: number;
  completedLessons: number;
  pendingLessons: number;
  classAddress?: string;
  classStartTime?: string;
  classEndTime?: string;
  scheduleCount: number;
  completedScheduleCount: number;
  cancelledScheduleCount: number;
  teacherBoundScheduleCount: number;
  classroomBoundScheduleCount: number;
  capacityBoundScheduleCount: number;
  attendanceRecordCount: number;
  attendanceMarkedMemberCount: number;
  teamRuntimeStatus: string;
};

export type CourseGroupTeamScheduleRow = {
  scheduleId: string;
  date: string;
  startTime: string;
  endTime: string;
  lessons: number;
  teacherId?: string;
  teacherName?: string;
  classroomId?: string;
  classroomName?: string;
  location?: string;
  capacity?: number;
  serviceCapacity?: number;
  resourceSnapshot?: Record<string, unknown>;
  status: string;
  remark?: string;
};

export type CourseGroupTeamAttendanceRow = {
  attendanceId: string;
  memberId: string;
  memberName: string;
  memberMobile?: string;
  date: string;
  attended: boolean;
  remark?: string;
};

type LeaderExtension = CourseGroupBuyExtension & {
  schedules?: CourseSchedule[];
  attendances?: CourseAttendance[];
};

@Injectable()
export class TeamCourseRuntimeService {
  private readonly extensionRepository: CourseGroupBuyExtensionRepository;

  constructor(
    prisma: PrismaService,
    tenantHelper: TenantHelper,
    extensionRepository?: CourseGroupBuyExtensionRepository,
  ) {
    this.extensionRepository = extensionRepository ?? new CourseGroupBuyExtensionRepository(prisma, tenantHelper);
  }

  /**
   * 团详情履约以团长扩展作为团队课程中心，虚拟成员不进入排课与考勤。
   */
  async getCourseSummary(input: {
    tenantId: string;
    teamId: string;
    teamRuntimeStatus: string;
  }): Promise<CourseGroupTeamCourseSummary> {
    const extension = await this.resolveLeaderExtension(input.tenantId, input.teamId);
    if (!extension) {
      return this.emptySummary(input.teamId, input.teamRuntimeStatus);
    }

    const schedules = extension.schedules ?? [];
    const attendances = extension.attendances ?? [];
    const totalLessons = Number(extension.totalLessons ?? 0);
    const completedLessons = Number(extension.completedLessons ?? 0);
    const attendanceMemberIds = new Set(attendances.map(attendance => attendance.memberId));

    return {
      teamId: input.teamId,
      leaderInstanceId: input.teamId,
      extensionReady: true,
      extensionId: extension.id,
      extensionStatus: extension.status,
      totalLessons,
      completedLessons,
      pendingLessons: Math.max(totalLessons - completedLessons, 0),
      classAddress: extension.classAddress ?? undefined,
      classStartTime: this.toIsoString(extension.classStartTime),
      classEndTime: this.toIsoString(extension.classEndTime),
      scheduleCount: schedules.length,
      completedScheduleCount: schedules.filter(schedule => schedule.status === 'COMPLETED').length,
      cancelledScheduleCount: schedules.filter(schedule => schedule.status === 'CANCELLED').length,
      teacherBoundScheduleCount: schedules.filter(schedule => Boolean(schedule.teacherId || schedule.teacherName)).length,
      classroomBoundScheduleCount: schedules.filter(schedule => Boolean(schedule.classroomId || schedule.classroomName)).length,
      capacityBoundScheduleCount: schedules.filter(schedule => this.hasPositiveCapacity(schedule)).length,
      attendanceRecordCount: attendances.length,
      attendanceMarkedMemberCount: attendanceMemberIds.size,
      teamRuntimeStatus: input.teamRuntimeStatus,
    };
  }

  async listSchedules(input: { tenantId: string; teamId: string }): Promise<CourseGroupTeamScheduleRow[]> {
    const extension = await this.resolveLeaderExtension(input.tenantId, input.teamId);
    if (!extension) return [];

    const schedules = await this.extensionRepository.findSchedulesByExtensionId(extension.id);
    return schedules.map(schedule => ({
      scheduleId: schedule.id,
      date: this.toIsoString(schedule.date) ?? '',
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      lessons: schedule.lessons,
      teacherId: schedule.teacherId ?? undefined,
      teacherName: schedule.teacherName ?? undefined,
      classroomId: schedule.classroomId ?? undefined,
      classroomName: schedule.classroomName ?? undefined,
      location: schedule.location ?? undefined,
      capacity: schedule.capacity ?? undefined,
      serviceCapacity: schedule.serviceCapacity ?? undefined,
      resourceSnapshot: this.toRecord(schedule.resourceSnapshot),
      status: schedule.status,
      remark: schedule.remark ?? undefined,
    }));
  }

  async listAttendances(input: {
    tenantId: string;
    teamId: string;
    attendanceMembers: TeamCourseRuntimeMember[];
  }): Promise<CourseGroupTeamAttendanceRow[]> {
    const extension = await this.resolveLeaderExtension(input.tenantId, input.teamId);
    if (!extension) return [];

    const memberMap = this.buildMemberMap(input.attendanceMembers);
    const attendances = await this.extensionRepository.findAttendancesByExtensionId(extension.id);

    return attendances
      .map<CourseGroupTeamAttendanceRow | null>(attendance => {
        const member = memberMap.get(attendance.memberId);
        if (!member) return null;
        return {
          attendanceId: attendance.id,
          memberId: attendance.memberId,
          memberName: member.name,
          memberMobile: member.mobile,
          date: this.toIsoString(attendance.date) ?? '',
          attended: attendance.attended,
          remark: attendance.remark ?? undefined,
        };
      })
      .filter((row): row is CourseGroupTeamAttendanceRow => Boolean(row));
  }

  async markAttendance(input: {
    tenantId: string;
    teamId: string;
    memberId: string;
    date: string;
    remark?: string;
    attendanceMembers: TeamCourseRuntimeMember[];
  }): Promise<CourseGroupTeamAttendanceRow> {
    const memberMap = this.buildMemberMap(input.attendanceMembers);
    BusinessException.throwIf(!memberMap.has(input.memberId), '仅真实履约成员可标记到课');

    const extension = await this.resolveLeaderExtension(input.tenantId, input.teamId);
    BusinessException.throwIfNull(extension, '课程扩展记录不存在');

    const date = new Date(input.date);
    BusinessException.throwIf(Number.isNaN(date.getTime()), '考勤日期不合法', ResponseCode.PARAM_INVALID);

    const schedule = await this.extensionRepository.findScheduleByDate(extension!.id, date);
    BusinessException.throwIfNull(schedule, '该日期没有排课');

    const attendance = await this.extensionRepository.markAttended(
      extension!.id,
      input.memberId,
      date,
      input.remark,
      input.tenantId,
    );
    const member = memberMap.get(input.memberId)!;

    return {
      attendanceId: attendance.id,
      memberId: attendance.memberId,
      memberName: member.name,
      memberMobile: member.mobile,
      date: this.toIsoString(attendance.date) ?? '',
      attended: attendance.attended,
      remark: attendance.remark ?? undefined,
    };
  }

  private async resolveLeaderExtension(tenantId: string, teamId: string): Promise<LeaderExtension | null> {
    return this.extensionRepository.findByInstanceId(teamId, tenantId);
  }

  private emptySummary(teamId: string, teamRuntimeStatus: string): CourseGroupTeamCourseSummary {
    return {
      teamId,
      leaderInstanceId: teamId,
      extensionReady: false,
      totalLessons: 0,
      completedLessons: 0,
      pendingLessons: 0,
      scheduleCount: 0,
      completedScheduleCount: 0,
      cancelledScheduleCount: 0,
      teacherBoundScheduleCount: 0,
      classroomBoundScheduleCount: 0,
      capacityBoundScheduleCount: 0,
      attendanceRecordCount: 0,
      attendanceMarkedMemberCount: 0,
      teamRuntimeStatus,
    };
  }

  private buildMemberMap(members: TeamCourseRuntimeMember[]) {
    return new Map(members.map(member => [member.memberId, member]));
  }

  private toIsoString(value?: Date | string | null) {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  private hasPositiveCapacity(schedule: CourseSchedule) {
    return Number(schedule.capacity ?? 0) > 0 || Number(schedule.serviceCapacity ?? 0) > 0;
  }

  private toRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return value as Record<string, unknown>;
  }
}

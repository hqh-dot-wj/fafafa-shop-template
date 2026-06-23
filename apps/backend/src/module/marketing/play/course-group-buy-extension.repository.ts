import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { CourseGroupBuyExtension, CourseSchedule, CourseAttendance, Prisma } from '@prisma/client';

/**
 * 课程拼团扩展表 Repository
 *
 * @description
 * 管理课程拼团的扩展数据，包括：
 * 1. 课程基本信息（总课时、上课地址等）
 * 2. 排课管理
 * 3. 考勤管理
 */
@Injectable()
export class CourseGroupBuyExtensionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  /**
   * 创建课程拼团扩展记录
   */
  async create(data: Prisma.CourseGroupBuyExtensionCreateInput): Promise<CourseGroupBuyExtension> {
    return this.prisma.courseGroupBuyExtension.create({
      data,
    });
  }

  /**
   * 根据实例ID查询扩展记录
   */
  async findByInstanceId(
    instanceId: string,
    tenantId?: string,
  ): Promise<(CourseGroupBuyExtension & { schedules: CourseSchedule[]; attendances: CourseAttendance[] }) | null> {
    return this.prisma.courseGroupBuyExtension.findFirst({
      where: this.tenantHelper.readWhereForDelegate('courseGroupBuyExtension', {
        instanceId,
        ...(tenantId ? { tenantId } : {}),
      }) as Prisma.CourseGroupBuyExtensionWhereInput,
      include: {
        schedules: {
          where: { delFlag: 'NORMAL' },
          orderBy: { date: 'asc' },
        },
        attendances: {
          where: { delFlag: 'NORMAL' },
          orderBy: { date: 'desc' },
        },
      },
    });
  }

  /**
   * 根据团ID查询所有扩展记录
   */
  async findByGroupId(groupId: string): Promise<CourseGroupBuyExtension[]> {
    return this.prisma.courseGroupBuyExtension.findMany({
      where: this.tenantHelper.readWhereForDelegate('courseGroupBuyExtension', {
        groupId,
        delFlag: 'NORMAL',
      }) as Prisma.CourseGroupBuyExtensionWhereInput,
      include: {
        instance: true,
      },
    });
  }

  /**
   * 更新扩展记录
   */
  async update(id: string, data: Prisma.CourseGroupBuyExtensionUpdateInput): Promise<CourseGroupBuyExtension> {
    return this.prisma.courseGroupBuyExtension.update({
      where: { id },
      data,
    });
  }

  /**
   * 更新已完成课时数
   */
  async updateCompletedLessons(id: string, completedLessons: number): Promise<CourseGroupBuyExtension> {
    return this.prisma.courseGroupBuyExtension.update({
      where: { id },
      data: { completedLessons },
    });
  }

  /**
   * 删除扩展记录（软删除）
   */
  async delete(id: string): Promise<CourseGroupBuyExtension> {
    return this.prisma.courseGroupBuyExtension.update({
      where: { id },
      data: { delFlag: 'DELETE' },
    });
  }

  // ==================== 排课管理 ====================

  /**
   * 创建排课记录
   */
  async createSchedule(data: Prisma.CourseScheduleCreateInput): Promise<CourseSchedule> {
    return this.prisma.courseSchedule.create({
      data,
    });
  }

  /**
   * 批量创建排课记录
   */
  async createSchedules(schedules: Prisma.CourseScheduleCreateManyInput[]): Promise<number> {
    const result = await this.prisma.courseSchedule.createMany({
      data: schedules,
    });
    return result.count;
  }

  /**
   * 查询排课记录
   */
  async findSchedulesByExtensionId(extensionId: string): Promise<CourseSchedule[]> {
    return this.prisma.courseSchedule.findMany({
      where: this.tenantHelper.readWhereForDelegate('courseSchedule', {
        extensionId,
        delFlag: 'NORMAL',
      }) as Prisma.CourseScheduleWhereInput,
      orderBy: { date: 'asc' },
    });
  }

  /**
   * 查询指定日期的排课
   */
  async findScheduleByDate(extensionId: string, date: Date): Promise<CourseSchedule | null> {
    return this.prisma.courseSchedule.findFirst({
      where: this.tenantHelper.readWhereForDelegate('courseSchedule', {
        extensionId,
        date,
        delFlag: 'NORMAL',
      }) as Prisma.CourseScheduleWhereInput,
    });
  }

  /**
   * 更新排课记录
   */
  async updateSchedule(id: string, data: Prisma.CourseScheduleUpdateInput): Promise<CourseSchedule> {
    return this.prisma.courseSchedule.update({
      where: { id },
      data,
    });
  }

  /**
   * 标记排课为已完成
   */
  async completeSchedule(id: string): Promise<CourseSchedule> {
    return this.prisma.courseSchedule.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });
  }

  /**
   * 取消排课
   */
  async cancelSchedule(id: string): Promise<CourseSchedule> {
    return this.prisma.courseSchedule.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * 删除排课记录（软删除）
   */
  async deleteSchedule(id: string): Promise<CourseSchedule> {
    return this.prisma.courseSchedule.update({
      where: { id },
      data: { delFlag: 'DELETE' },
    });
  }

  // ==================== 考勤管理 ====================

  /**
   * 创建考勤记录
   */
  async createAttendance(data: Prisma.CourseAttendanceCreateInput): Promise<CourseAttendance> {
    return this.prisma.courseAttendance.create({
      data,
    });
  }

  /**
   * 批量创建考勤记录
   */
  async createAttendances(attendances: Prisma.CourseAttendanceCreateManyInput[]): Promise<number> {
    const result = await this.prisma.courseAttendance.createMany({
      data: attendances,
      skipDuplicates: true, // 跳过重复记录
    });
    return result.count;
  }

  /**
   * 查询考勤记录
   */
  async findAttendancesByExtensionId(extensionId: string): Promise<CourseAttendance[]> {
    return this.prisma.courseAttendance.findMany({
      where: this.tenantHelper.readWhereForDelegate('courseAttendance', {
        extensionId,
        delFlag: 'NORMAL',
      }) as Prisma.CourseAttendanceWhereInput,
      orderBy: { date: 'desc' },
    });
  }

  /**
   * 查询学员的考勤记录
   */
  async findAttendancesByMember(extensionId: string, memberId: string): Promise<CourseAttendance[]> {
    return this.prisma.courseAttendance.findMany({
      where: this.tenantHelper.readWhereForDelegate('courseAttendance', {
        extensionId,
        memberId,
        delFlag: 'NORMAL',
      }) as Prisma.CourseAttendanceWhereInput,
      orderBy: { date: 'desc' },
    });
  }

  /**
   * 查询指定日期的考勤记录
   */
  async findAttendanceByDate(extensionId: string, memberId: string, date: Date): Promise<CourseAttendance | null> {
    return this.prisma.courseAttendance.findFirst({
      where: this.tenantHelper.readWhereForDelegate('courseAttendance', {
        extensionId_memberId_date: {
          extensionId,
          memberId,
          date,
        },
      }) as Prisma.CourseAttendanceWhereInput,
    });
  }

  /**
   * 更新考勤记录
   */
  async updateAttendance(id: string, data: Prisma.CourseAttendanceUpdateInput): Promise<CourseAttendance> {
    return this.prisma.courseAttendance.update({
      where: { id },
      data,
    });
  }

  /**
   * 标记出勤
   */
  async markAttended(
    extensionId: string,
    memberId: string,
    date: Date,
    remark?: string,
    tenantId?: string,
  ): Promise<CourseAttendance> {
    const createData = {
      extensionId,
      memberId,
      date,
      attended: true,
      remark,
    };

    return this.prisma.courseAttendance.upsert({
      where: {
        extensionId_memberId_date: {
          extensionId,
          memberId,
          date,
        },
      },
      create: tenantId ? { ...createData, tenantId } : this.tenantHelper.setTenantId(createData),
      update: {
        attended: true,
        remark,
      },
    });
  }

  /**
   * 统计学员出勤率
   */
  async getAttendanceRate(
    extensionId: string,
    memberId: string,
  ): Promise<{ total: number; attended: number; rate: number }> {
    const total = await this.prisma.courseAttendance.count({
      where: this.tenantHelper.readWhereForDelegate('courseAttendance', {
        extensionId,
        memberId,
        delFlag: 'NORMAL',
      }) as Prisma.CourseAttendanceWhereInput,
    });

    const attended = await this.prisma.courseAttendance.count({
      where: this.tenantHelper.readWhereForDelegate('courseAttendance', {
        extensionId,
        memberId,
        attended: true,
        delFlag: 'NORMAL',
      }) as Prisma.CourseAttendanceWhereInput,
    });

    return {
      total,
      attended,
      rate: total > 0 ? attended / total : 0,
    };
  }

  /**
   * 删除考勤记录（软删除）
   */
  async deleteAttendance(id: string): Promise<CourseAttendance> {
    return this.prisma.courseAttendance.update({
      where: { id },
      data: { delFlag: 'DELETE' },
    });
  }
}

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { User } from 'src/common/decorators/user.decorator';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { CourseGroupLifecycleService } from './services/lifecycle.service';
import { CourseGroupMemberService } from './services/member.service';
import { CourseGroupReadService } from './services/read.service';
import { VirtualFillService } from './services/virtual-fill.service';

/**
 * 后台拼课治理接口，与 CourseGroupStoreController 共享读写服务但使用后台权限点。
 * admin-web 当前拼课执行页走 /store/course-group；若页面切到 /admin/course-group，需要同步校验权限码和操作文案。
 */
@ApiTags('营销-拼课管理')
@ApiBearerAuth('Authorization')
@Controller('admin/course-group')
export class CourseGroupAdminController {
  constructor(
    private readonly lifecycleService: CourseGroupLifecycleService,
    private readonly memberService: CourseGroupMemberService,
    private readonly readService: CourseGroupReadService,
    private readonly virtualFillService: VirtualFillService,
  ) {}

  @Get('team/list')
  @Api({ summary: '拼课团列表' })
  @RequirePermission('marketing:course-group:team:list')
  listTeams(
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: string,
    @Query('pageNum') pageNum?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.readService.listStoreTeams({
      tenantId,
      status,
      pageNum: pageNum ? Number(pageNum) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('team/:teamId')
  @Api({ summary: '拼课团详情' })
  @RequirePermission('marketing:course-group:team:query')
  getTeamDetail(@Param('teamId') teamId: string, @Query('tenantId') tenantId?: string) {
    return this.readService.getStoreTeamDetail({ teamId, tenantId });
  }

  @Get('team/:teamId/members')
  @Api({ summary: '拼课团成员列表' })
  @RequirePermission('marketing:course-group:team:query')
  getTeamMembers(@Param('teamId') teamId: string, @Query('tenantId') tenantId?: string) {
    return this.memberService.getStoreTeamMembers({ teamId, tenantId });
  }

  @Get('team/:teamId/course-summary')
  @Api({ summary: '拼课团课程总览' })
  @RequirePermission('marketing:course-group:team:query')
  getTeamCourseSummary(@Param('teamId') teamId: string, @Query('tenantId') tenantId?: string) {
    return this.readService.getStoreTeamCourseSummary({ teamId, tenantId });
  }

  @Get('team/:teamId/schedules')
  @Api({ summary: '拼课团排课列表' })
  @RequirePermission('marketing:course-group:team:query')
  getTeamSchedules(@Param('teamId') teamId: string, @Query('tenantId') tenantId?: string) {
    return this.readService.getStoreTeamSchedules({ teamId, tenantId });
  }

  @Get('team/:teamId/attendances')
  @Api({ summary: '拼课团考勤列表' })
  @RequirePermission('marketing:course-group:team:query')
  getTeamAttendances(@Param('teamId') teamId: string, @Query('tenantId') tenantId?: string) {
    return this.memberService.getStoreTeamAttendances({ teamId, tenantId });
  }

  @Post('team/:teamId/attendance')
  @Api({ summary: '拼课团标记到课' })
  @RequirePermission('marketing:course-group:team:edit')
  markTeamAttendance(
    @Param('teamId') teamId: string,
    @Body() body: { tenantId?: string; memberId: string; date: string; remark?: string },
  ) {
    return this.memberService.markStoreTeamAttendance({
      teamId,
      tenantId: body?.tenantId,
      memberId: body?.memberId,
      date: body?.date,
      remark: body?.remark,
    });
  }

  @Post('team/:teamId/close')
  @Api({ summary: '关闭拼课团' })
  @RequirePermission('marketing:course-group:team:close')
  closeTeam(@Param('teamId') teamId: string, @Body() body?: { tenantId?: string }) {
    return this.lifecycleService.closeTeam({
      teamId,
      tenantId: body?.tenantId,
    });
  }

  @Post('team/:teamId/start-class')
  @Api({ summary: '开始上课' })
  @RequirePermission('marketing:course-group:team:edit')
  startClass(@Param('teamId') teamId: string, @Body() body?: { tenantId?: string }) {
    return this.lifecycleService.startClass({
      teamId,
      tenantId: body?.tenantId,
    });
  }

  @Post('team/:teamId/finish-class')
  @Api({ summary: '结束课程' })
  @RequirePermission('marketing:course-group:team:edit')
  finishClass(@Param('teamId') teamId: string, @Body() body?: { tenantId?: string }) {
    return this.lifecycleService.finishClass({
      teamId,
      tenantId: body?.tenantId,
    });
  }

  @Post('team/:teamId/member/:memberRecordId/failure-resolution')
  @Api({ summary: '成员失败处理' })
  @RequirePermission('marketing:course-group:member:edit')
  resolveMemberFailure(
    @Param('teamId') teamId: string,
    @Param('memberRecordId') memberRecordId: string,
    @Body() body?: { tenantId?: string; reason?: string },
  ) {
    return this.memberService.resolveMemberFailure({
      teamId,
      memberRecordId,
      tenantId: body?.tenantId,
      reason: body?.reason,
    });
  }

  @Post('team/:teamId/virtual-fill')
  @Api({ summary: '后台人工补位' })
  @RequirePermission('marketing:course-group:team:edit')
  addVirtualFill(
    @Param('teamId') teamId: string,
    @Body() body?: { tenantId?: string; count?: number; reason?: string },
    @User('userId') userId?: string | number,
  ) {
    return this.virtualFillService.addStoreTeamVirtualFill({
      teamId,
      tenantId: body?.tenantId,
      count: body?.count,
      reason: body?.reason,
      operatorId: userId,
    });
  }

  @Post('team/:teamId/virtual-fill/:virtualMemberId/remove')
  @Api({ summary: '后台撤销虚拟补位' })
  @RequirePermission('marketing:course-group:team:edit')
  removeVirtualFill(
    @Param('teamId') teamId: string,
    @Param('virtualMemberId') virtualMemberId: string,
    @Body() body?: { tenantId?: string; reason?: string },
    @User('userId') userId?: string | number,
  ) {
    return this.virtualFillService.removeStoreTeamVirtualFill({
      teamId,
      tenantId: body?.tenantId,
      virtualMemberId,
      reason: body?.reason,
      operatorId: userId,
    });
  }
}

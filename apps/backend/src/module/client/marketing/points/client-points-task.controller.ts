import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';
import { Member } from 'src/module/client/common/decorators/member.decorator';
import { MemberAuthGuard } from 'src/module/client/common/guards/member-auth.guard';
import { normalizeClientPageQuery } from 'src/module/client/common/utils/pagination';
import { PointsTaskService } from 'src/module/marketing/points/task/task.service';

/**
 * C端积分任务控制器
 *
 * @tenantScope TenantBound（依赖会员登录态租户隔离）
 */
@ApiTags('C端-积分任务')
@ApiBearerAuth()
@Controller('client/marketing/points/tasks')
@UseGuards(MemberAuthGuard)
export class ClientPointsTaskController {
  constructor(private readonly taskService: PointsTaskService) {}

  /**
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get()
  @Api({ summary: '查询可用任务列表' })
  async findAvailableTasks() {
    return this.taskService.findAll({ isEnabled: true });
  }

  /**
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Post(':taskKey/complete')
  @Api({ summary: '完成任务' })
  async completeTask(@Member('memberId') memberId: string, @Param('taskKey') taskKey: string) {
    BusinessException.throwIf(!taskKey?.trim(), '任务标识不能为空', ResponseCode.PARAM_INVALID);
    return this.taskService.completeTask(memberId, taskKey);
  }

  /**
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('my-completions')
  @Api({ summary: '查询我的任务完成记录' })
  async getMyCompletions(
    @Member('memberId') memberId: string,
    @Query('pageNum') pageNum?: string | number,
    @Query('pageSize') pageSize?: string | number,
  ) {
    const page = normalizeClientPageQuery(pageNum, pageSize);
    return this.taskService.getUserCompletions(memberId, page.pageNum, page.pageSize);
  }
}

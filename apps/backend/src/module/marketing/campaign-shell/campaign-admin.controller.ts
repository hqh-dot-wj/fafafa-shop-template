import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { User, UserDto } from 'src/module/admin/system/user/user.decorator';
import { ActivityCalendarQueryDto } from '../activity/dto/activity-calendar-query.dto';
import { ActivityQueryDto } from '../activity/dto/activity-query.dto';
import { CreateActivityDto } from '../activity/dto/create-activity.dto';
import { UpdateActivityDto } from '../activity/dto/update-activity.dto';
import { ActivityCalendarVo } from '../activity/vo/activity-calendar.vo';
import { ActivityDashboardVo } from '../activity/vo/activity-dashboard.vo';
import { ActivityListVo, ActivityVo } from '../activity/vo/activity.vo';
import { CreateActivityItemDto } from '../activity-item/dto/create-activity-item.dto';
import { UpdateActivityItemDto } from '../activity-item/dto/update-activity-item.dto';
import { CampaignAdminService } from './campaign-admin.service';

/**
 * 活动中心写模型入口，对应 admin-web service/api/marketing/activity.ts。
 * 前端 activityId 实际落到这里的 campaignId，状态流转必须继续走 publish/pause/archive 三个显式动作。
 */
@ApiTags('营销-活动中心（Campaign）')
@ApiBearerAuth('Authorization')
@Controller('admin/marketing/campaigns')
export class CampaignAdminController {
  constructor(private readonly service: CampaignAdminService) {}

  @Get('list')
  @Api({ summary: '活动列表', type: ActivityListVo })
  @RequirePermission('marketing:activity:list')
  list(@Query() query: ActivityQueryDto) {
    return this.service.list(query);
  }

  @Get('calendar')
  @Api({ summary: '活动日历视图', type: ActivityCalendarVo })
  @RequirePermission('marketing:activity:list')
  calendar(@Query() query: ActivityCalendarQueryDto) {
    return this.service.calendar(query);
  }

  @Get('dashboard')
  @Api({ summary: '活动驾驶舱视图', type: ActivityDashboardVo })
  @RequirePermission('marketing:activity:list')
  dashboard(@Query() query: ActivityCalendarQueryDto) {
    return this.service.dashboard(query);
  }

  @Post()
  @Api({ summary: '创建活动', type: ActivityVo })
  @RequirePermission('marketing:activity:create')
  create(@Body() dto: CreateActivityDto, @User() user: UserDto) {
    return this.service.create(dto, String(user.user.userId));
  }

  @Get('detail/:campaignId')
  @Api({ summary: '活动详情', type: ActivityVo })
  @RequirePermission('marketing:activity:query')
  detail(@Param('campaignId') campaignId: string) {
    return this.service.findOne(campaignId);
  }

  @Put('detail/:campaignId')
  @Api({ summary: '更新活动', type: ActivityVo })
  @RequirePermission('marketing:activity:edit')
  update(@Param('campaignId') campaignId: string, @Body() dto: UpdateActivityDto, @User() user: UserDto) {
    return this.service.update(campaignId, dto, String(user.user.userId));
  }

  @Post(':campaignId/publish')
  @Api({ summary: '发布活动' })
  @RequirePermission('marketing:activity:edit')
  publish(@Param('campaignId') campaignId: string, @User() user: UserDto) {
    return this.service.publish(campaignId, String(user.user.userId));
  }

  @Post(':campaignId/pause')
  @Api({ summary: '暂停活动' })
  @RequirePermission('marketing:activity:edit')
  pause(@Param('campaignId') campaignId: string, @User() user: UserDto) {
    return this.service.pause(campaignId, String(user.user.userId));
  }

  @Post(':campaignId/archive')
  @Api({ summary: '归档活动' })
  @RequirePermission('marketing:activity:edit')
  archive(@Param('campaignId') campaignId: string, @User() user: UserDto) {
    return this.service.archive(campaignId, String(user.user.userId));
  }

  @Delete('detail/:campaignId')
  @Api({ summary: '删除活动' })
  @RequirePermission('marketing:activity:remove')
  remove(@Param('campaignId') campaignId: string) {
    return this.service.remove(campaignId);
  }

  @Get(':campaignId/items')
  @Api({ summary: '活动商品列表' })
  @RequirePermission('marketing:activity:list')
  listItems(@Param('campaignId') campaignId: string) {
    return this.service.listItems(campaignId);
  }

  @Post(':campaignId/items')
  @Api({ summary: '新增活动商品' })
  @RequirePermission('marketing:activity:edit')
  createItem(@Param('campaignId') campaignId: string, @Body() dto: CreateActivityItemDto, @User() user: UserDto) {
    return this.service.createItem(campaignId, dto as unknown as Record<string, unknown>, String(user.user.userId));
  }

  @Put(':campaignId/items/:activityItemId')
  @Api({ summary: '更新活动商品' })
  @RequirePermission('marketing:activity:edit')
  updateItem(
    @Param('campaignId') campaignId: string,
    @Param('activityItemId') activityItemId: string,
    @Body() dto: UpdateActivityItemDto,
    @User() user: UserDto,
  ) {
    return this.service.updateItem(
      campaignId,
      activityItemId,
      dto as unknown as Record<string, unknown>,
      String(user.user.userId),
    );
  }

  @Delete(':campaignId/items/:activityItemId')
  @Api({ summary: '删除活动商品' })
  @RequirePermission('marketing:activity:edit')
  deleteItem(
    @Param('campaignId') campaignId: string,
    @Param('activityItemId') activityItemId: string,
    @User() user: UserDto,
  ) {
    return this.service.deleteItem(campaignId, activityItemId, String(user.user.userId));
  }
}

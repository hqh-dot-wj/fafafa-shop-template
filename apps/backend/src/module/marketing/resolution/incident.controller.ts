import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { TenantContext } from 'src/common/tenant';
import { BusinessType } from 'src/common/constant/business.constant';
import { Operlog } from 'src/module/admin/common/decorators/operlog.decorator';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { User, UserDto } from 'src/module/admin/system/user/user.decorator';
import { HandleIncidentDto, IncidentQueryDto } from './dto/incident-query.dto';
import { IncidentService } from './incident.service';

/**
 * 营销排障中心
 * 对应 admin-web service/api/marketing/resolution.ts 的 incidents 接口。
 * 工单处理只更新排障状态与备注，不在这里直接修复订单、佣金或活动配置。
 *
 * @tenantScope TenantScoped
 */
@ApiTags('营销-排障中心')
@Controller('marketing/resolution')
@ApiBearerAuth('Authorization')
export class IncidentController {
  constructor(private readonly incidentService: IncidentService) {}

  @Get('incidents')
  @Api({ summary: '查询排障工单列表' })
  @RequirePermission('marketing:scene:list')
  async listIncidents(@Query() query: IncidentQueryDto, @User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    return await TenantContext.run({ tenantId }, () =>
      this.incidentService.listIncidents({
        ...query,
        tenantId,
      }),
    );
  }

  @Post('incidents/:id/handle')
  @Api({ summary: '处理排障工单' })
  @RequirePermission('marketing:resolution:simulate')
  @Operlog({ businessType: BusinessType.UPDATE })
  async handleIncident(@Param('id') id: string, @Body() body: HandleIncidentDto, @User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const operator = String(user.user?.userName || user.user?.userId || 'system');
    return await TenantContext.run({ tenantId }, () =>
      this.incidentService.handleIncident(tenantId, id, body, operator),
    );
  }
}

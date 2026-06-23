import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { Result } from 'src/common/response';
import { TenantContext } from 'src/common/tenant';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { User, UserDto } from 'src/module/admin/system/user/user.decorator';
import { ResolutionObservabilityService } from './resolution-observability.service';

/**
 * 营销裁决监控指标
 * 对应 admin-web service/api/marketing/resolution.ts 的 metrics dashboard 接口。
 * 指标只读展示当前租户裁决健康度，告警处理仍走 IncidentController。
 *
 * @tenantScope TenantScoped
 */
@ApiTags('营销-裁决监控')
@Controller('marketing/resolution/metrics')
@ApiBearerAuth('Authorization')
export class ResolutionMetricsController {
  constructor(private readonly observability: ResolutionObservabilityService) {}

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Get('dashboard')
  @Api({ summary: '获取裁决监控看板（汇总 + 场景排行 + 告警）' })
  @RequirePermission('marketing:scene:list')
  async getDashboard(@User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const data = await TenantContext.run({ tenantId }, () => this.observability.getDashboard(tenantId));
    return Result.ok(data);
  }
}

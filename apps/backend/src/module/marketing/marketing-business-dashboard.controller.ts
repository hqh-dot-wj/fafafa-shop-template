import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { Result } from 'src/common/response/result';
import { TenantContext } from 'src/common/tenant';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { User, UserDto } from 'src/module/admin/system/user/user.decorator';
import { BusinessDashboardQueryDto } from './dto/business-dashboard-query.dto';
import { MarketingBusinessDashboardService } from './marketing-business-dashboard.service';
import { MarketingBusinessDashboardVo } from './vo/business-dashboard.vo';

/**
 * 营销统一经营视图
 * @tenantScope TenantScoped
 */
@ApiTags('营销-经营视图')
@Controller('marketing')
@ApiBearerAuth('Authorization')
export class MarketingBusinessDashboardController {
  constructor(private readonly service: MarketingBusinessDashboardService) {}

  @Get('business-dashboard')
  @Api({ summary: '查询统一经营视图', type: MarketingBusinessDashboardVo })
  @RequirePermission('marketing:scene:list')
  async getDashboard(@Query() query: BusinessDashboardQueryDto, @User() user: UserDto) {
    const tenantId = query.tenantId || user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const data = await TenantContext.run({ tenantId }, () =>
      this.service.getDashboard({
        tenantId,
      }),
    );
    return Result.ok(data);
  }
}

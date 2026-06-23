import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { Result } from 'src/common/response';
import { TenantContext } from 'src/common/tenant';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { User, UserDto } from 'src/module/admin/system/user/user.decorator';
import { MarketingRuntimeLedgerService } from './marketing-runtime-ledger.service';

/**
 * C 端营销运行时开关台账（只读）
 * @tenantScope TenantScoped
 */
@ApiTags('营销-运行时台账')
@Controller('marketing/runtime-ledger')
@ApiBearerAuth('Authorization')
export class MarketingRuntimeLedgerController {
  constructor(private readonly ledger: MarketingRuntimeLedgerService) {}

  @Get()
  @Api({ summary: '列出 C 端营销相关 sys_config 键及当前生效值' })
  @RequirePermission('marketing:scene:list')
  async list(@User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const data = await TenantContext.run({ tenantId }, () => this.ledger.listRows(tenantId));
    return Result.ok(data);
  }
}

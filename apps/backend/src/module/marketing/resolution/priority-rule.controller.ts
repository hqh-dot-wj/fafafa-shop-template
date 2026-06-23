import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { Operlog } from 'src/module/admin/common/decorators/operlog.decorator';
import { BusinessType } from 'src/common/constant/business.constant';
import { TenantContext } from 'src/common/tenant';
import { User, UserDto } from 'src/module/admin/system/user/user.decorator';
import { PriorityRuleService } from './priority-rule.service';
import { UpsertPriorityRuleDto } from './dto/priority-rule.dto';

/**
 * 活动优先级规则管理
 * 对应 admin-web service/api/marketing/resolution.ts 的 priority-rule 接口。
 * 这些规则会影响裁决排序，初始化默认值也必须在当前租户上下文内执行。
 *
 * @tenantScope TenantScoped
 */
@ApiTags('营销-活动优先级规则')
@Controller('marketing/resolution/priority-rule')
@ApiBearerAuth('Authorization')
export class PriorityRuleController {
  constructor(private readonly service: PriorityRuleService) {}

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Get('list')
  @Api({ summary: '查询优先级规则列表' })
  @RequirePermission('marketing:priority:list')
  async findAll(@User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    return await this.service.findAll(tenantId);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Post()
  @Api({ summary: '创建/更新优先级规则' })
  @RequirePermission('marketing:priority:edit')
  @Operlog({ businessType: BusinessType.INSERT })
  async upsert(@Body() dto: UpsertPriorityRuleDto, @User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    return await this.service.upsert(tenantId, dto);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Delete(':id')
  @Api({ summary: '删除优先级规则' })
  @RequirePermission('marketing:priority:delete')
  @Operlog({ businessType: BusinessType.DELETE })
  async remove(@Param('id') id: string, @User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    return await this.service.remove(id, tenantId);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Post('init-defaults')
  @Api({ summary: '初始化默认优先级' })
  @RequirePermission('marketing:priority:edit')
  @Operlog({ businessType: BusinessType.INSERT })
  async initDefaults(@User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    return await this.service.initDefaults(tenantId);
  }
}

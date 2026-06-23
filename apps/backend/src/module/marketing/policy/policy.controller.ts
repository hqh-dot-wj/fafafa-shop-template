import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { Result } from 'src/common/response';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { Operlog } from 'src/module/admin/common/decorators/operlog.decorator';
import { BusinessType } from 'src/common/constant/business.constant';
import { TenantContext } from 'src/common/tenant';
import { User, UserDto } from 'src/module/admin/system/user/user.decorator';
import { MarketingPolicyService } from './policy.service';
import {
  ListPolicyDto,
  SaveSourcePolicyDto,
  SaveResolverPolicyDto,
  SaveAudiencePolicyDto,
  SaveSortPolicyDto,
  SaveCardTemplateDto,
} from './dto/policy.dto';

/**
 * 营销策略中心
 * 对应 admin-web service/api/marketing/policy.ts；五个保存接口分别维护策略的商品池、裁决、受众、排序和卡片模板分面。
 *
 * @tenantScope TenantScoped
 */
@ApiTags('营销-策略中心')
@Controller('marketing/policy')
@ApiBearerAuth('Authorization')
export class MarketingPolicyController {
  constructor(private readonly service: MarketingPolicyService) {}

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Get('list')
  @Api({ summary: '查询策略列表' })
  @RequirePermission('marketing:policy:list')
  async list(@Query() query: ListPolicyDto, @User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const data = await TenantContext.run({ tenantId }, () => this.service.list(query));
    return Result.ok(data);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Post('source')
  @Api({ summary: '保存商品池策略' })
  @RequirePermission('marketing:policy:edit')
  @Operlog({ businessType: BusinessType.UPDATE })
  async saveSource(@Body() dto: SaveSourcePolicyDto, @User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const data = await TenantContext.run({ tenantId }, () => this.service.saveSourcePolicy(dto));
    return Result.ok(data);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Post('resolver')
  @Api({ summary: '保存裁决策略' })
  @RequirePermission('marketing:policy:edit')
  @Operlog({ businessType: BusinessType.UPDATE })
  async saveResolver(@Body() dto: SaveResolverPolicyDto, @User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const data = await TenantContext.run({ tenantId }, () => this.service.saveResolverPolicy(dto));
    return Result.ok(data);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Post('audience')
  @Api({ summary: '保存受众策略' })
  @RequirePermission('marketing:policy:edit')
  @Operlog({ businessType: BusinessType.UPDATE })
  async saveAudience(@Body() dto: SaveAudiencePolicyDto, @User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const data = await TenantContext.run({ tenantId }, () => this.service.saveAudiencePolicy(dto));
    return Result.ok(data);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Post('sort')
  @Api({ summary: '保存排序策略' })
  @RequirePermission('marketing:policy:edit')
  @Operlog({ businessType: BusinessType.UPDATE })
  async saveSort(@Body() dto: SaveSortPolicyDto, @User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const data = await TenantContext.run({ tenantId }, () => this.service.saveSortPolicy(dto));
    return Result.ok(data);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Post('card-template')
  @Api({ summary: '保存卡片模板策略' })
  @RequirePermission('marketing:policy:edit')
  @Operlog({ businessType: BusinessType.UPDATE })
  async saveCardTemplate(@Body() dto: SaveCardTemplateDto, @User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const data = await TenantContext.run({ tenantId }, () => this.service.saveCardTemplate(dto));
    return Result.ok(data);
  }
}

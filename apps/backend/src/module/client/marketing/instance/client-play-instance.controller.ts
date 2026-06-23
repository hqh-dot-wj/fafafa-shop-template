import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { MemberAuthGuard } from 'src/module/client/common/guards/member-auth.guard';
import { Member } from 'src/module/client/common/decorators/member.decorator';
import { PlayInstanceService } from 'src/module/marketing/instance/instance.service';

/**
 * C 端玩法实例详情，对应 miniapp-client/src/pages/marketing/detail.vue。
 * 只允许会员查看本人实例，页面展示金额和按钮态不能替代订单服务的最终校验。
 *
 * @tenantScope TenantScoped
 * @sloCategory client
 * @sloLatency P99 < 800ms
 */
@ApiTags('C端-营销实例')
@ApiBearerAuth()
@UseGuards(MemberAuthGuard)
@Controller('client/marketing/instance')
export class ClientPlayInstanceController {
  constructor(private readonly playInstanceService: PlayInstanceService) {}

  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get(':id')
  @Api({ summary: '查询本人营销玩法实例详情' })
  async getMine(@Param('id') id: string, @Member('memberId') memberId: string) {
    const tenantId = TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;
    return TenantContext.run({ tenantId }, () => this.playInstanceService.findOneForClient(id, memberId));
  }
}

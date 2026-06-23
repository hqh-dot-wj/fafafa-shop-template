import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ActivityService } from './activity.service';
import { NewcomerStatusVo } from './vo/newcomer-status.vo';
import { Api } from 'src/common/decorators/api.decorator';
import { MemberAuthGuard } from 'src/module/client/common/guards/member-auth.guard';
import { Member } from 'src/module/client/common/decorators/member.decorator';

/**
 * 营销活动客户端接口
 * @tenantScope TenantScoped
 * @sloCategory core
 */
@ApiTags('客户端-营销活动')
@Controller('client/marketing/newcomer')
@ApiBearerAuth('Authorization')
@UseGuards(MemberAuthGuard)
export class ActivityClientController {
  constructor(private readonly service: ActivityService) {}

  /**
   * @sloCategory core
   * @sloLatency P99 < 500ms
   */
  @Get('check')
  @Api({ summary: '检查新人资格', type: NewcomerStatusVo })
  async checkNewcomerStatus(@Member('memberId') memberId: string) {
    return this.service.checkNewcomerStatus(memberId);
  }

  /**
   * @sloCategory core
   * @sloLatency P99 < 500ms
   */
  @Post('claim')
  @Api({ summary: '领取新人礼包' })
  async claimNewcomerRewards(@Member('memberId') memberId: string) {
    return this.service.claimNewcomerRewards(memberId);
  }
}

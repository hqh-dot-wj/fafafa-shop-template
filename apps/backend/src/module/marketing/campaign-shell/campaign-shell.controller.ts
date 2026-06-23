import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { Result } from 'src/common/response';
import { CampaignShellQueryDto } from './dto/campaign-shell-query.dto';
import { CampaignShellService } from './campaign-shell.service';
import { CampaignApprovalLogVo } from './vo/campaign-approval-log.vo';
import { CampaignPrecheckShellVo } from './vo/campaign-precheck-shell.vo';
import { CampaignWizardShellVo } from './vo/campaign-wizard-shell.vo';
import { CampaignWorkbenchShellVo } from './vo/campaign-workbench-shell.vo';

/**
 * 活动编排壳只提供只读页面骨架数据，对应 admin-web service/api/marketing/campaign.ts。
 * 活动创建、发布、归档等写操作由 CampaignAdminController 承接，避免工作台壳接口混入状态流转。
 */
@ApiTags('营销-活动壳子')
@ApiBearerAuth('Authorization')
@Controller('admin/marketing/campaigns')
export class CampaignShellController {
  constructor(private readonly service: CampaignShellService) {}

  @Get('wizard-shell')
  @Api({ summary: '获取营销活动新建向导壳子', type: CampaignWizardShellVo })
  async getWizardShell(): Promise<Result<CampaignWizardShellVo>> {
    return Result.ok(this.service.getWizardShell());
  }

  @Get(':campaignId/workbench-shell')
  @Api({ summary: '获取营销活动工作台壳子', type: CampaignWorkbenchShellVo })
  async getWorkbenchShell(@Param() query: CampaignShellQueryDto): Promise<Result<CampaignWorkbenchShellVo>> {
    return Result.ok(await this.service.getWorkbenchShell(query));
  }

  @Get(':campaignId/approval-log-shell')
  @Api({ summary: '获取营销活动审批日志壳子', type: CampaignApprovalLogVo })
  async getApprovalLogShell(@Param() query: CampaignShellQueryDto): Promise<Result<CampaignApprovalLogVo>> {
    return Result.ok(await this.service.getApprovalLogShell(query));
  }

  @Get(':campaignId/precheck-shell')
  @Api({ summary: '获取营销活动预检发布壳子', type: CampaignPrecheckShellVo })
  async getPrecheckShell(@Param() query: CampaignShellQueryDto): Promise<Result<CampaignPrecheckShellVo>> {
    return Result.ok(await this.service.getPrecheckShell(query));
  }
}

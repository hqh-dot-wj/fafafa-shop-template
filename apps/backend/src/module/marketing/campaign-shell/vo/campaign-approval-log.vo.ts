import { ApiProperty } from '@nestjs/swagger';

export class CampaignApprovalLogEntryVo {
  @ApiProperty({ description: '日志ID' })
  id: string;

  @ApiProperty({ description: '动作执行人' })
  actor: string;

  @ApiProperty({ description: '动作说明' })
  action: string;

  @ApiProperty({ description: '动作状态' })
  status: string;

  @ApiProperty({ description: '动作时间' })
  time: string;
}

export class CampaignApprovalLogVo {
  @ApiProperty({ description: '营销活动ID' })
  campaignId: string;

  @ApiProperty({ description: '当前壳子是否只读' })
  readonly: boolean;

  @ApiProperty({ description: '审批日志摘要', type: [CampaignApprovalLogEntryVo] })
  entries: CampaignApprovalLogEntryVo[];

  @ApiProperty({ description: '协作入口动作', type: [String] })
  collaborationActions: string[];
}

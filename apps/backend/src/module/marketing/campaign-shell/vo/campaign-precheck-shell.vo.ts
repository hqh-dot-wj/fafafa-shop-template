import { ApiProperty } from '@nestjs/swagger';

export class CampaignPrecheckItemVo {
  @ApiProperty({ description: '检查项键' })
  key: string;

  @ApiProperty({ description: '检查项标题' })
  title: string;

  @ApiProperty({ description: '检查状态' })
  status: string;

  @ApiProperty({ description: '检查说明' })
  note: string;
}

export class CampaignPrecheckShellVo {
  @ApiProperty({ description: '营销活动ID' })
  campaignId: string;

  @ApiProperty({ description: '是否可直接发布' })
  publishReady: boolean;

  @ApiProperty({ description: '预检项摘要', type: [CampaignPrecheckItemVo] })
  checks: CampaignPrecheckItemVo[];

  @ApiProperty({ description: '可执行的发布相关动作', type: [String] })
  publishActions: string[];
}

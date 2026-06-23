import { ApiProperty } from '@nestjs/swagger';

export class CampaignWizardStepVo {
  @ApiProperty({ description: '步骤键' })
  key: string;

  @ApiProperty({ description: '步骤标题' })
  title: string;

  @ApiProperty({ description: '步骤说明' })
  note: string;

  @ApiProperty({ description: '当前步骤是否只读' })
  readonly: boolean;
}

export class CampaignWizardShellVo {
  @ApiProperty({ description: '壳子契约版本' })
  version: string;

  @ApiProperty({ description: '向导步骤列表', type: [CampaignWizardStepVo] })
  steps: CampaignWizardStepVo[];

  @ApiProperty({ description: '当前批次排除的深水域', type: [String] })
  excludedDomains: string[];

  @ApiProperty({ description: '向导阶段支持的入口动作', type: [String] })
  actionEntry: string[];
}

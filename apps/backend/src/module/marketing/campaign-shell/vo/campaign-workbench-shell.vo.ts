import { ApiProperty } from '@nestjs/swagger';

export class CampaignWorkbenchTabVo {
  @ApiProperty({ description: 'Tab 键' })
  key: string;

  @ApiProperty({ description: 'Tab 标题' })
  title: string;

  @ApiProperty({ description: '当前 Tab 是否可编辑' })
  editable: boolean;
}

export class CampaignWorkbenchReadWriteBoundaryVo {
  @ApiProperty({ description: '可编辑 Tab', type: [String] })
  writableTabs: string[];

  @ApiProperty({ description: '只读 Tab', type: [String] })
  readonlyTabs: string[];
}

export class CampaignWorkbenchShellVo {
  @ApiProperty({ description: '营销活动ID' })
  campaignId: string;

  @ApiProperty({ description: '工作台 Tab 列表', type: [CampaignWorkbenchTabVo] })
  tabs: CampaignWorkbenchTabVo[];

  @ApiProperty({ description: '工作台读写边界', type: CampaignWorkbenchReadWriteBoundaryVo })
  readWriteBoundary: CampaignWorkbenchReadWriteBoundaryVo;

  @ApiProperty({ description: '仅提供壳子的面板列表', type: [String] })
  shellOnlyPanels: string[];
}

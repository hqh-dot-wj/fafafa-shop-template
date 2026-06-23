import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlayTemplateVo {
  @ApiProperty({ description: '模板 ID' })
  id: string;

  @ApiProperty({ description: '模板名称' })
  name: string;

  @ApiProperty({ description: '模板编码' })
  code: string;

  @ApiProperty({ description: '计量单位' })
  unitName: string;

  @ApiProperty({ description: '规则 Schema 配置', type: 'object', additionalProperties: true })
  ruleSchema: Record<string, unknown>;

  @ApiPropertyOptional({ description: '详情交互模板标识', type: String, nullable: true })
  uiComponentId?: string | null;

  @ApiProperty({ description: '创建时间' })
  createTime: string;

  @ApiProperty({ description: '更新时间' })
  updateTime: string;
}

export class PlayTemplateListVo {
  @ApiProperty({ description: '模板列表', type: [PlayTemplateVo] })
  rows: PlayTemplateVo[];

  @ApiProperty({ description: '总条数' })
  total: number;
}

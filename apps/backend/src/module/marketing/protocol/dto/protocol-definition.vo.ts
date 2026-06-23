import { ApiProperty } from '@nestjs/swagger';
import { JourneySettingsDto } from './journey-settings.dto';

export class MarketingProtocolCanonicalMappingVo {
  @ApiProperty({ description: '旧能力标识' })
  legacy: string;

  @ApiProperty({ description: '统一后的真相源标识' })
  canonical: string;

  @ApiProperty({ description: '所属模块' })
  owner: string;
}

export class MarketingProtocolMutabilityRuleVo {
  @ApiProperty({ description: '变更区域' })
  area: string;

  @ApiProperty({ description: '草稿态可变更策略' })
  draft: string;

  @ApiProperty({ description: '待发布态可变更策略' })
  pending: string;

  @ApiProperty({ description: '已发布态可变更策略' })
  published: string;
}

export class MarketingProtocolCutoverItemVo {
  @ApiProperty({ description: '切换面向的承载面' })
  surface: string;

  @ApiProperty({ description: '旧入口路由标识' })
  routeName: string;

  @ApiProperty({ description: '替代入口路由标识' })
  replacement: string;

  @ApiProperty({ description: '切换阶段' })
  phase: string;

  @ApiProperty({ description: '兼容层下线日期' })
  dropAfter: string;
}

export class MarketingProtocolDefinitionVo {
  @ApiProperty({ description: '协议版本' })
  version: string;

  @ApiProperty({ description: '旧能力到真相源的映射', type: [MarketingProtocolCanonicalMappingVo] })
  canonicalMapping: MarketingProtocolCanonicalMappingVo[];

  @ApiProperty({ description: '停止模式', type: [String] })
  stopModes: string[];

  @ApiProperty({ description: '可变更矩阵', type: [MarketingProtocolMutabilityRuleVo] })
  mutabilityMatrix: MarketingProtocolMutabilityRuleVo[];

  @ApiProperty({ description: '切换注册表', type: [MarketingProtocolCutoverItemVo] })
  cutoverRegistry: MarketingProtocolCutoverItemVo[];

  @ApiProperty({ description: '切换原则', type: [String] })
  cutoverPrinciples: string[];

  @ApiProperty({ description: '约束合同', type: [String] })
  requiredContracts: string[];

  @ApiProperty({ description: '旅程设置结构', type: JourneySettingsDto, required: false })
  journeySettingsTemplate?: JourneySettingsDto;
}

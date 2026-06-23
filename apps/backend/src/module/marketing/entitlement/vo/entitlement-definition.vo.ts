import { ApiProperty } from '@nestjs/swagger';
import { EntitlementDefinitionDto, EntitlementDisallowedScope, EntitlementPoolType } from '../dto/entitlement-definition.dto';

export class EntitlementCompileTargetVo {
  @ApiProperty({ description: '运行 owner', example: 'pms / product-activity-view / resolution' })
  owner: string;

  @ApiProperty({ description: '运行时产物', type: [String], example: ['product-candidate', 'activity-card', 'scene-view'] })
  runtimeArtifacts: string[];
}

export class EntitlementDefinitionCompileTargetsVo {
  @ApiProperty({ description: '商品池编排目标', type: EntitlementCompileTargetVo })
  product: EntitlementCompileTargetVo;

  @ApiProperty({ description: '券池编排目标', type: EntitlementCompileTargetVo })
  coupon: EntitlementCompileTargetVo;

  @ApiProperty({ description: '积分池编排目标', type: EntitlementCompileTargetVo })
  points: EntitlementCompileTargetVo;
}

export class EntitlementDefinitionVo extends EntitlementDefinitionDto {
  @ApiProperty({ description: '契约版本', example: '2026-04-19' })
  version: string;

  @ApiProperty({ description: '支持的权益池类型', enum: ['PRODUCT', 'COUPON', 'POINTS'], type: [String] })
  poolTypes: EntitlementPoolType[];

  @ApiProperty({ description: '三类池的 owner 与产物', type: EntitlementDefinitionCompileTargetsVo })
  compileTargets: EntitlementDefinitionCompileTargetsVo & Record<string, unknown>;

  @ApiProperty({ description: '禁止触点', type: [String], enum: ['notification', 'share'] })
  disallowedScopes: EntitlementDisallowedScope[];
}

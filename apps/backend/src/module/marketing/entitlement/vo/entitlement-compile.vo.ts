import { ApiProperty } from '@nestjs/swagger';
import { EntitlementPoolType } from '../dto/entitlement-definition.dto';

export class EntitlementPoolCompileTargetVo {
  @ApiProperty({ description: '运行 owner', example: 'pms / product-activity-view / resolution' })
  owner: string;

  @ApiProperty({ description: '运行时产物', type: [String], example: ['product-candidate', 'activity-card', 'scene-view'] })
  runtimeArtifacts: string[];

  @ApiProperty({
    description: '编排过程被禁止的数据/引擎痕迹（用于自检说明）',
    type: [String],
    example: ['coupon-stock-ledger'],
    required: false,
  })
  forbiddenFacts: string[];
}

export class EntitlementPoolCompileResultVo {
  @ApiProperty({ description: '池类型', enum: ['PRODUCT', 'COUPON', 'POINTS'], example: 'PRODUCT' })
  poolType: EntitlementPoolType;

  @ApiProperty({ description: '池标识', example: 'pool-001' })
  poolId: string;

  @ApiProperty({ description: '编译目标', type: EntitlementPoolCompileTargetVo })
  compileTarget: EntitlementPoolCompileTargetVo;

  @ApiProperty({ description: '编译预览', type: Object, required: false })
  preview: Record<string, unknown>;

  @ApiProperty({ description: '风险摘要', type: [String], example: ['未开启积分上限校验时仅返回软提示'], required: false })
  riskSummary: string[];
}

export class EntitlementCompileVo {
  @ApiProperty({ description: '权益池编译结果', type: [EntitlementPoolCompileResultVo] })
  pools: EntitlementPoolCompileResultVo[];

  @ApiProperty({ description: 'owner 约束', type: Object, example: ['pms / product-activity-view / resolution'] })
  owners: string[];

  @ApiProperty({ description: '全局风险摘要', type: [String], required: false })
  riskSummary: string[];
}

import { ApiProperty } from '@nestjs/swagger';

const ENTITLEMENT_POOLS = ['PRODUCT', 'COUPON', 'POINTS'] as const;

export type EntitlementPoolType = (typeof ENTITLEMENT_POOLS)[number];

const DISALLOWED_SCOPES = ['notification', 'share'] as const;

export type EntitlementDisallowedScope = (typeof DISALLOWED_SCOPES)[number];

export class EntitlementDefinitionDto {
  @ApiProperty({ description: '权益池类型', example: ENTITLEMENT_POOLS, type: [String] })
  poolTypes: EntitlementPoolType[];

  @ApiProperty({
    description: '编排范围',
    example: [
      {
        type: 'PRODUCT',
        owner: 'pms / product-activity-view / resolution',
      },
    ],
    type: Object,
  })
  compileTargets: Record<string, unknown>;

  @ApiProperty({
    description: '本批次不允许的触点',
    example: DISALLOWED_SCOPES,
    type: [String],
  })
  disallowedScopes: EntitlementDisallowedScope[];
}

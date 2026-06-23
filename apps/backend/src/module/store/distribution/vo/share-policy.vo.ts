import { DistShareAttributionMode, DistShareBindingMode } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class SharePolicyVo {
  @ApiProperty({ description: '策略ID', example: 1 })
  id: number;

  @ApiProperty({ description: '租户ID', example: '000001' })
  tenantId: string;

  @ApiProperty({ description: '分享链接有效期（分钟）', example: 1440 })
  linkExpireMinutes: number;

  @ApiProperty({ description: '点击次数上限', example: 100 })
  maxClickCount: number;

  @ApiProperty({ description: '绑定次数上限', example: 20 })
  maxBindCount: number;

  @ApiProperty({ description: '归因订单次数上限', example: 20 })
  maxOrderCount: number;

  @ApiProperty({ description: '绑定模式', enum: DistShareBindingMode })
  bindingMode: DistShareBindingMode;

  @ApiProperty({ description: '归因模式', enum: DistShareAttributionMode })
  attributionMode: DistShareAttributionMode;

  @ApiProperty({ description: '归因有效期（分钟）', example: 43200 })
  attributionWindowMinutes: number;

  @ApiProperty({ description: '是否允许跨店绑定', example: false })
  enableCrossTenantBind: boolean;

  @ApiProperty({ description: '策略是否启用', example: true })
  isActive: boolean;

  @ApiProperty({ description: '创建时间', example: '2026-04-22 14:30:00' })
  createTime: string;

  @ApiProperty({ description: '更新时间', example: '2026-04-22 14:35:00' })
  updateTime: string;
}

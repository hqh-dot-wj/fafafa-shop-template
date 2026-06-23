import { DistShareBizType, DistShareTokenStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ShareTokenVo {
  @ApiProperty({ description: '分享令牌 sid', example: 'DST_ABC123' })
  sid: string;

  @ApiProperty({ description: '租户ID', example: '000001' })
  tenantId: string;

  @ApiProperty({ description: '分享人会员ID', example: 'member_001' })
  shareUserId: string;

  @ApiProperty({ description: '业务类型', enum: DistShareBizType })
  bizType: DistShareBizType;

  @ApiProperty({ description: '业务ID', example: 'product_1001' })
  bizId: string;

  @ApiProperty({ description: '过期时间', example: '2026-04-23 14:30:00' })
  expireAt: string;

  @ApiProperty({ description: '点击上限', example: 100 })
  maxClickCount: number;

  @ApiProperty({ description: '绑定上限', example: 20 })
  maxBindCount: number;

  @ApiProperty({ description: '归因订单上限', example: 20 })
  maxOrderCount: number;

  @ApiProperty({ description: '当前点击次数', example: 0 })
  clickCount: number;

  @ApiProperty({ description: '当前绑定次数', example: 0 })
  bindCount: number;

  @ApiProperty({ description: '当前归因订单次数', example: 0 })
  orderCount: number;

  @ApiProperty({ description: '令牌状态', enum: DistShareTokenStatus })
  status: DistShareTokenStatus;

  @ApiProperty({ description: '分享落地链接', example: '/pages/distribution/entry?sid=DST_ABC123' })
  shareUrl: string;

  @ApiPropertyOptional({ description: '扩展元数据', type: Object })
  metadata?: Record<string, unknown> | null;
}

export class ShareTokenQrcodeVo {
  @ApiProperty({ description: '分享令牌 sid', example: 'DST_ABC123' })
  sid: string;

  @ApiProperty({ description: '小程序码图片URL', example: 'https://cdn.example.com/2026/04/22/share_token.png' })
  qrCodeUrl: string;

  @ApiProperty({ description: '小程序码 scene', example: 'sid=DST_ABC123' })
  scene: string;
}

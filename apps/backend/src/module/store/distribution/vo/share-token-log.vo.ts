import { DistShareBizType, DistShareEventType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ShareTokenLogVo {
  @ApiProperty({ description: '事件ID', example: 'clx123abc' })
  id: string;

  @ApiProperty({ description: '分享令牌 sid', example: 'DST_ABC123' })
  sid: string;

  @ApiProperty({ description: '租户ID', example: '000001' })
  tenantId: string;

  @ApiPropertyOptional({ description: '分享人ID', example: 'member_share' })
  shareUserId?: string | null;

  @ApiPropertyOptional({ description: '命中会员ID', example: 'member_target' })
  memberId?: string | null;

  @ApiProperty({ description: '事件类型', enum: DistShareEventType })
  eventType: DistShareEventType;

  @ApiPropertyOptional({ description: '业务类型', enum: DistShareBizType })
  bizType?: DistShareBizType | null;

  @ApiPropertyOptional({ description: '业务ID', example: 'product_1001' })
  bizId?: string | null;

  @ApiPropertyOptional({ description: '错误/状态代码', example: 'SHARE_EXPIRED' })
  eventCode?: string | null;

  @ApiPropertyOptional({ description: '错误/状态描述', example: '分销链接已过期' })
  eventMessage?: string | null;

  @ApiPropertyOptional({ description: '订单ID', example: 'order_1001' })
  orderId?: string | null;

  @ApiPropertyOptional({ description: '扩展元数据', type: Object })
  metadata?: Record<string, unknown> | null;

  @ApiProperty({ description: '创建时间', example: '2026-04-22 14:40:00' })
  createTime: string;
}

import { DistShareEventType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

const CLIENT_SHARE_EVENT_TYPES = [
  DistShareEventType.CLICK,
  DistShareEventType.BIND,
  DistShareEventType.EXPIRED_HIT,
  DistShareEventType.LIMIT_HIT,
  DistShareEventType.INVALID_HIT,
  DistShareEventType.MANUAL_DISABLE,
] as const;

type ClientShareEventType = (typeof CLIENT_SHARE_EVENT_TYPES)[number];

export class TrackShareEventDto {
  @ApiProperty({ description: '分享凭证 sid', example: 'DST_ABCD1234' })
  @IsString()
  @MaxLength(64)
  sid: string;

  @ApiProperty({ description: '分享事件类型', enum: CLIENT_SHARE_EVENT_TYPES, example: DistShareEventType.BIND })
  @IsIn(CLIENT_SHARE_EVENT_TYPES)
  eventType: ClientShareEventType;

  @ApiPropertyOptional({ description: '关联订单ID（订单归因时传）', example: 'order_1001' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  orderId?: string;

  @ApiPropertyOptional({ description: '扩展字段', type: Object })
  @IsOptional()
  @IsObject()
  ext?: Record<string, unknown>;
}

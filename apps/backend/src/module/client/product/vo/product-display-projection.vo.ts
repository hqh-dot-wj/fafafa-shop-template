import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductDisplayTagVo {
  @ApiProperty({ description: '商品展示标签编码', enum: ['NEW', 'STORE_RECOMMEND', 'FREE_SHIPPING', 'SERVICE_HOME'] })
  code: 'NEW' | 'STORE_RECOMMEND' | 'FREE_SHIPPING' | 'SERVICE_HOME';

  @ApiProperty({ description: '商品展示标签文案' })
  label: string;

  @ApiProperty({ description: '标签来源', enum: ['RULE', 'FACT', 'MANUAL'] })
  source: 'RULE' | 'FACT' | 'MANUAL';

  @ApiProperty({ description: '展示优先级，数值越大越靠前' })
  priority: number;
}

export class ProductPurchaseStatusVo {
  @ApiProperty({ description: '购买状态编码', enum: ['NORMAL', 'BOOKING_REQUIRED'] })
  code: 'NORMAL' | 'BOOKING_REQUIRED';

  @ApiProperty({ description: '购买状态文案' })
  label: string;

  @ApiProperty({ description: '当前是否可购买' })
  purchasable: boolean;
}

export class ProductServiceSummaryVo {
  @ApiProperty({ description: '服务展示摘要' })
  label: string;

  @ApiProperty({ description: '是否需要预约' })
  needBooking: boolean;

  @ApiPropertyOptional({ description: '服务时长，单位分钟', type: Number, nullable: true })
  serviceDuration?: number | null;

  @ApiPropertyOptional({ description: '服务半径，单位米', type: Number, nullable: true })
  serviceRadius?: number | null;
}

export class ClientActivitySummaryVo {
  @ApiProperty({ description: '活动上下文键' })
  activityContextKey: string;

  @ApiProperty({ description: '活动类型' })
  activityType: string;

  @ApiProperty({ description: '营销价签文案' })
  tagLabel: string;

  @ApiProperty({ description: '活动展示价' })
  displayPrice: number;
}

export class ClientMainActivityVo {
  @ApiProperty({ description: '活动上下文键' })
  activityContextKey: string;

  @ApiProperty({ description: '活动类型' })
  activityType: string;

  @ApiProperty({ description: '活动配置ID' })
  configId: string;

  @ApiProperty({ description: '活动名称' })
  activityName: string;

  @ApiProperty({ description: '活动价' })
  activityPrice: number;

  @ApiProperty({ description: '原价' })
  originalPrice: number;

  @ApiProperty({ description: '分佣模式' })
  commissionMode: string;

  @ApiProperty({ description: '活动状态' })
  status: string;

  @ApiPropertyOptional({ description: '活动开始时间', type: String, format: 'date-time', nullable: true })
  startTime?: Date | null;

  @ApiPropertyOptional({ description: '活动结束时间', type: String, format: 'date-time', nullable: true })
  endTime?: Date | null;

  @ApiPropertyOptional({ description: '活动剩余库存', type: Number, nullable: true })
  remainingStock?: number | null;

  @ApiPropertyOptional({ description: '活动规则配置', nullable: true })
  rules?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '活动展示数据', nullable: true })
  displayData?: Record<string, unknown> | null;
}

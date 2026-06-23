import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlayInstanceStatus } from '@prisma/client';

export class InstanceProbeBaseVo {
  @ApiProperty({ description: '实例ID' })
  id: string;

  @ApiProperty({ description: '租户ID' })
  tenantId: string;

  @ApiProperty({ description: '会员ID' })
  memberId: string;

  @ApiProperty({ description: '关联配置ID' })
  configId: string;

  @ApiProperty({ description: '玩法模板编码' })
  templateCode: string;

  @ApiPropertyOptional({ description: '订单号' })
  orderSn?: string | null;

  @ApiPropertyOptional({ description: '系统订单ID' })
  orderId?: string | null;

  @ApiProperty({ description: '实例状态', enum: PlayInstanceStatus })
  status: PlayInstanceStatus;

  @ApiProperty({ description: '创建时间' })
  createTime: string;

  @ApiPropertyOptional({ description: '支付时间' })
  payTime?: string | null;

  @ApiPropertyOptional({ description: '结束时间' })
  endTime?: string | null;

  @ApiProperty({ description: '更新时间' })
  updateTime: string;

  @ApiProperty({ description: '实例业务数据' })
  instanceData: Record<string, unknown>;
}

export class InstanceProbeTimelineVo {
  @ApiProperty({ description: '时间线编码' })
  code:
    | 'INSTANCE_CREATED'
    | 'INSTANCE_PAID'
    | 'INSTANCE_SUCCESS'
    | 'INSTANCE_FAILED'
    | 'INSTANCE_TIMEOUT'
    | 'INSTANCE_REFUNDED'
    | 'UNKNOWN';

  @ApiProperty({ description: '事件类型' })
  type: string;

  @ApiPropertyOptional({ description: '事件来源步骤' })
  sourceStep?: string;

  @ApiPropertyOptional({ description: '链路追踪ID' })
  traceId?: string;

  @ApiProperty({ description: '事件时间' })
  timestamp: string;

  @ApiProperty({ description: '事件负载' })
  payload: Record<string, unknown>;
}

export class InstanceProbeAbnormalityVo {
  @ApiProperty({ description: '异常码' })
  code: string;

  @ApiProperty({ description: '异常等级' })
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiProperty({ description: '异常说明' })
  message: string;

  @ApiPropertyOptional({ description: '异常发生时间（ISO）' })
  occurredAt?: string;

  @ApiPropertyOptional({ description: '关联 traceId' })
  traceId?: string;

  @ApiPropertyOptional({ description: '扩展上下文' })
  context?: Record<string, unknown>;
}

export class InstanceProbeVo {
  @ApiProperty({ description: '实例基础信息', type: InstanceProbeBaseVo })
  base: InstanceProbeBaseVo;

  @ApiProperty({ description: '时间线', type: [InstanceProbeTimelineVo] })
  timeline: InstanceProbeTimelineVo[];

  @ApiProperty({ description: '异常列表', type: [InstanceProbeAbnormalityVo] })
  abnormalities: InstanceProbeAbnormalityVo[];

  @ApiProperty({ description: '是否存在异常' })
  hasAbnormalities: boolean;
}

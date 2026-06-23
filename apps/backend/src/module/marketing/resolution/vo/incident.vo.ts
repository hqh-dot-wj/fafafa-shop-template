import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum IncidentType {
  METRIC_ALERT = 'METRIC_ALERT',
  PROBE_STEP_MISSING = 'PROBE_STEP_MISSING',
  TEAM_PROJECTION_DRIFT = 'TEAM_PROJECTION_DRIFT',
  TEAM_EFFECT_APPLY_FAILED = 'TEAM_EFFECT_APPLY_FAILED',
  TEAM_COURSE_ARTIFACT_MISSING = 'TEAM_COURSE_ARTIFACT_MISSING',
  TEAM_FINANCE_EVIDENCE_MISSING = 'TEAM_FINANCE_EVIDENCE_MISSING',
  TEAM_MANUAL_REVIEW_REQUIRED = 'TEAM_MANUAL_REVIEW_REQUIRED',
}

export enum IncidentLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum IncidentStatus {
  OPEN = 'OPEN',
  ACK = 'ACK',
  RESOLVED = 'RESOLVED',
  IGNORED = 'IGNORED',
}

export enum IncidentAction {
  ACK = 'ACK',
  RESOLVE = 'RESOLVE',
  IGNORE = 'IGNORE',
}

export class IncidentHandleRecordVo {
  @ApiProperty({ description: '处理动作', enum: IncidentAction })
  action: IncidentAction;

  @ApiPropertyOptional({ description: '备注' })
  remark?: string;

  @ApiProperty({ description: '处理人' })
  operator: string;

  @ApiProperty({ description: '处理时间（ISO）' })
  handledAt: string;
}

export class IncidentVo {
  @ApiProperty({ description: '工单 ID' })
  id: string;

  @ApiProperty({ description: '租户 ID' })
  tenantId: string;

  @ApiProperty({ description: '工单类型', enum: IncidentType })
  type: IncidentType;

  @ApiProperty({ description: '工单等级', enum: IncidentLevel })
  level: IncidentLevel;

  @ApiProperty({ description: '工单状态', enum: IncidentStatus })
  status: IncidentStatus;

  @ApiProperty({ description: '标题' })
  title: string;

  @ApiProperty({ description: '说明' })
  message: string;

  @ApiPropertyOptional({ description: '关联资源 ID（如 instanceId、告警码）' })
  referenceId?: string;

  @ApiPropertyOptional({ description: '告警码/异常码' })
  code?: string;

  @ApiPropertyOptional({ description: '关联追踪 ID' })
  traceId?: string | null;

  @ApiPropertyOptional({ description: '扩展上下文' })
  context?: Record<string, unknown>;

  @ApiProperty({ description: '发生时间（ISO）' })
  occurredAt: string;

  @ApiPropertyOptional({ description: '最近处理记录' })
  latestHandle?: IncidentHandleRecordVo;
}

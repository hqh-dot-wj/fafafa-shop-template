import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventCatalogItemVo } from '../../events/vo/event-catalog.vo';
import { IncidentVo } from './incident.vo';

export class ResolutionTraceSceneResolveSampleVo {
  @ApiProperty({ description: '采样日期，格式 yyyyMMdd' })
  date: string;

  @ApiProperty({ description: 'Trace ID' })
  traceId: string;

  @ApiProperty({ description: '当日命中次数' })
  hitCount: number;

  @ApiProperty({ description: '场景编码' })
  sceneCode: string;

  @ApiPropertyOptional({ description: '场景发布版本号' })
  releaseNo?: number;

  @ApiProperty({ description: '返回模块数' })
  moduleCount: number;

  @ApiProperty({ description: '空模块数' })
  emptyModuleCount: number;

  @ApiProperty({ description: '渠道' })
  channel: string;

  @ApiProperty({ description: '耗时，毫秒' })
  durationMs: number;

  @ApiProperty({ description: '裁决状态', enum: ['SUCCESS', 'FAILED'] })
  status: 'SUCCESS' | 'FAILED';

  @ApiProperty({ description: '记录时间' })
  recordedAt: string;

  @ApiPropertyOptional({
    description: '场景裁决 explain 快照，用于复盘候选、过滤和选中链路',
    type: 'object',
    additionalProperties: true,
  })
  explainSnapshot?: Record<string, unknown>;
}

export class ResolutionTraceCacheInvalidationSampleVo {
  @ApiProperty({ description: '采样日期，格式 yyyyMMdd' })
  date: string;

  @ApiProperty({ description: 'Trace ID' })
  traceId: string;

  @ApiProperty({ description: '当日命中次数' })
  hitCount: number;

  @ApiProperty({ description: '缓存失效事件类型' })
  eventType: string;

  @ApiPropertyOptional({ description: '关联场景编码' })
  sceneCode?: string;

  @ApiProperty({ description: '删除缓存键数量' })
  deletedKeys: number;

  @ApiProperty({ description: '耗时，毫秒' })
  durationMs: number;

  @ApiProperty({ description: '记录时间' })
  recordedAt: string;
}

export class ResolutionTraceAuditSampleVo {
  @ApiProperty({ description: '采样日期，格式 yyyyMMdd' })
  date: string;

  @ApiProperty({ description: 'Trace ID' })
  traceId: string;

  @ApiProperty({ description: 'Trace 类型', enum: ['SCENE_RESOLVE', 'CACHE_INVALIDATION'] })
  traceKind: 'SCENE_RESOLVE' | 'CACHE_INVALIDATION';

  @ApiPropertyOptional({ description: '关联场景编码' })
  sceneCode?: string;

  @ApiPropertyOptional({ description: '场景发布版本号' })
  releaseNo?: number;

  @ApiPropertyOptional({ description: '渠道' })
  channel?: string;

  @ApiProperty({ description: '状态', enum: ['SUCCESS', 'FAILED'] })
  status: 'SUCCESS' | 'FAILED';

  @ApiPropertyOptional({ description: '返回模块数' })
  moduleCount?: number;

  @ApiPropertyOptional({ description: '空模块数' })
  emptyModuleCount?: number;

  @ApiPropertyOptional({ description: '缓存失效事件类型' })
  eventType?: string;

  @ApiPropertyOptional({ description: '删除缓存键数量' })
  deletedKeys?: number;

  @ApiProperty({ description: '耗时，毫秒' })
  durationMs: number;

  @ApiProperty({ description: '记录时间' })
  recordedAt: string;

  @ApiPropertyOptional({
    description: '长期审计 explain 快照，用于复盘候选、过滤和选中链路',
    type: 'object',
    additionalProperties: true,
  })
  explainSnapshot?: Record<string, unknown>;
}

export class ResolutionTraceDiagnosticVo {
  @ApiProperty({ description: '租户 ID' })
  tenantId: string;

  @ApiProperty({ description: 'Trace ID' })
  traceId: string;

  @ApiProperty({ description: '查询日期列表', type: [String] })
  dates: string[];

  @ApiProperty({ description: '是否命中 trace 样本' })
  found: boolean;

  @ApiProperty({ description: '场景裁决样本', type: [ResolutionTraceSceneResolveSampleVo] })
  sceneResolve: ResolutionTraceSceneResolveSampleVo[];

  @ApiProperty({ description: '缓存失效样本', type: [ResolutionTraceCacheInvalidationSampleVo] })
  cacheInvalidation: ResolutionTraceCacheInvalidationSampleVo[];

  @ApiProperty({ description: '长期审计 trace 样本', type: [ResolutionTraceAuditSampleVo] })
  persistentTrace: ResolutionTraceAuditSampleVo[];

  @ApiProperty({ description: '关联事件目录项', type: [EventCatalogItemVo] })
  relatedEvents: EventCatalogItemVo[];

  @ApiProperty({ description: '关联排障工单', type: [IncidentVo] })
  relatedIncidents: IncidentVo[];
}

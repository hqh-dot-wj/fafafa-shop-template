import { Injectable } from '@nestjs/common';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { ResponseCode } from 'src/common/response/response.interface';
import { EventCatalogItemVo, toEventCatalogItemVo } from '../events/vo/event-catalog.vo';
import { MARKETING_EVENT_CATALOG_LIST } from '../events/marketing-event.catalog';
import { IncidentService } from './incident.service';
import { ResolutionObservabilityService } from './resolution-observability.service';
import { IncidentVo } from './vo/incident.vo';
import { ResolutionTraceDiagnosticVo } from './vo/resolution-diagnostic.vo';

@Injectable()
export class ResolutionDiagnosticService {
  constructor(
    private readonly observability: ResolutionObservabilityService,
    private readonly incidentService: IncidentService,
  ) {}

  async getTraceDiagnostic(input: {
    tenantId: string;
    traceId: string;
    days?: number;
  }): Promise<ResolutionTraceDiagnosticVo> {
    const traceId = this.normalizeTraceId(input.traceId);
    const [traceSnapshot, relatedIncidents] = await Promise.all([
      this.observability.getTraceDiagnostics({
        tenantId: input.tenantId,
        traceId,
        days: input.days,
      }),
      this.loadRelatedIncidents(input.tenantId, traceId),
    ]);
    const relatedEvents = this.resolveRelatedEvents(
      [
        ...traceSnapshot.cacheInvalidation.map(item => item.eventType),
        ...traceSnapshot.persistentTrace.map(item => item.eventType ?? ''),
      ],
    );

    return {
      tenantId: traceSnapshot.tenantId,
      traceId: traceSnapshot.traceId,
      dates: traceSnapshot.dates,
      found:
        traceSnapshot.sceneResolve.length > 0 ||
        traceSnapshot.cacheInvalidation.length > 0 ||
        traceSnapshot.persistentTrace.length > 0,
      sceneResolve: traceSnapshot.sceneResolve,
      cacheInvalidation: traceSnapshot.cacheInvalidation,
      persistentTrace: traceSnapshot.persistentTrace,
      relatedEvents,
      relatedIncidents,
    };
  }

  private async loadRelatedIncidents(tenantId: string, traceId: string): Promise<IncidentVo[]> {
    const result = await this.incidentService.listIncidents({
      tenantId,
      keyword: traceId,
      pageNum: 1,
      pageSize: 20,
    });
    return result.data?.rows ?? [];
  }

  private normalizeTraceId(raw: string): string {
    const traceId = raw.trim();
    if (!traceId) {
      BusinessException.throw(ResponseCode.PARAM_INVALID, 'traceId不能为空');
    }
    return traceId;
  }

  private resolveRelatedEvents(eventTypes: string[]): EventCatalogItemVo[] {
    const typeSet = new Set(eventTypes.filter(Boolean));
    if (typeSet.size === 0) {
      return [];
    }
    return MARKETING_EVENT_CATALOG_LIST
      .filter(item => typeSet.has(item.eventType))
      .map(toEventCatalogItemVo);
  }
}

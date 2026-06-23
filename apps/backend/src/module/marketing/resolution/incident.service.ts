import { Injectable } from '@nestjs/common';
import { Result } from 'src/common/response/result';
import { RedisService } from 'src/module/common/redis/redis.service';
import { InstanceProbeService } from '../instance/instance-probe.service';
import { IncidentAction, IncidentLevel, IncidentStatus, IncidentType, IncidentVo } from './vo/incident.vo';
import { ResolutionMetricsAlert, ResolutionObservabilityService } from './resolution-observability.service';

interface IncidentHandleState {
  status: IncidentStatus;
  latestHandle: {
    action: IncidentAction;
    remark?: string;
    operator: string;
    handledAt: string;
  };
}

interface ProbeAbnormalRow {
  instanceId: string;
  code: string;
  level?: string;
  message?: string;
  traceId?: string | null;
  occurredAt?: string;
  context?: Record<string, unknown>;
}

interface IncidentQueryInput {
  tenantId?: string;
  status?: IncidentStatus;
  level?: IncidentLevel;
  type?: IncidentType;
  keyword?: string;
  pageNum?: number;
  pageSize?: number;
}

@Injectable()
export class IncidentService {
  private readonly incidentActionPrefix = 'marketing:resolution:incident:action';
  private readonly incidentReportPrefix = 'marketing:resolution:incident:report';
  private readonly incidentActionTtlMs = 30 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly redis: RedisService,
    private readonly resolutionObservability: ResolutionObservabilityService,
    private readonly instanceProbeService: InstanceProbeService,
  ) {}

  async listIncidents(query: IncidentQueryInput) {
    const tenantId = query.tenantId || '000000';
    const [dashboard, probeRows, reportedRows] = await Promise.all([
      this.resolutionObservability.getDashboard(tenantId),
      this.instanceProbeService.listAbnormalProbes(tenantId),
      this.loadReportedIncidents(tenantId),
    ]);

    const now = new Date().toISOString();
    const metricRows = this.buildMetricAlertRows(tenantId, dashboard.overview.alerts, now);
    const probeIncidentRows = this.buildProbeRows(tenantId, probeRows);
    const combinedRows = [...metricRows, ...probeIncidentRows, ...reportedRows];
    const rowsWithState = await this.hydrateIncidentState(tenantId, combinedRows);
    const filteredRows = this.filterRows(rowsWithState, query);
    const sortedRows = filteredRows.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));

    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;
    const start = (pageNum - 1) * pageSize;
    const pagedRows = sortedRows.slice(start, start + pageSize);

    return Result.page(pagedRows, sortedRows.length, pageNum, pageSize);
  }

  async handleIncident(
    tenantId: string,
    incidentId: string,
    payload: { action: IncidentAction; remark?: string },
    operator: string,
  ) {
    const status = this.actionToStatus(payload.action);
    const nextState: IncidentHandleState = {
      status,
      latestHandle: {
        action: payload.action,
        remark: payload.remark?.trim() || undefined,
        operator,
        handledAt: new Date().toISOString(),
      },
    };

    await this.redis.set(this.buildActionKey(tenantId, incidentId), nextState, this.incidentActionTtlMs);

    return Result.ok({
      id: incidentId,
      tenantId,
      status,
      latestHandle: nextState.latestHandle,
    });
  }

  async reportIncident(incident: IncidentVo) {
    await this.redis.set(this.buildReportKey(incident.tenantId, incident.id), incident, this.incidentActionTtlMs);
    return Result.ok(incident);
  }

  private buildMetricAlertRows(tenantId: string, alerts: ResolutionMetricsAlert[], occurredAt: string): IncidentVo[] {
    return alerts.map(alert => ({
      id: `metric:${alert.code}`,
      tenantId,
      type: IncidentType.METRIC_ALERT,
      level: this.alertLevelToIncidentLevel(alert.level),
      status: IncidentStatus.OPEN,
      title: `指标告警：${alert.code}`,
      message: alert.message,
      referenceId: alert.code,
      code: alert.code,
      occurredAt,
      context: {
        threshold: alert.threshold,
        actual: alert.actual,
      },
    }));
  }

  private buildProbeRows(tenantId: string, rows: ProbeAbnormalRow[]): IncidentVo[] {
    return rows.map(row => ({
      id: `probe:${row.instanceId}:${row.code}`,
      tenantId,
      type: IncidentType.PROBE_STEP_MISSING,
      level: this.stringLevelToIncidentLevel(row.level),
      status: IncidentStatus.OPEN,
      title: `旅程探针异常：${row.code}`,
      message: row.message || '探针检测到异常步骤',
      referenceId: row.instanceId,
      code: row.code,
      traceId: row.traceId ?? null,
      occurredAt: row.occurredAt || new Date().toISOString(),
      context: row.context,
    }));
  }

  private async hydrateIncidentState(tenantId: string, rows: IncidentVo[]): Promise<IncidentVo[]> {
    return await Promise.all(
      rows.map(async row => {
        const saved = (await this.redis.get(this.buildActionKey(tenantId, row.id))) as IncidentHandleState | null;
        if (!saved) {
          return row;
        }
        return {
          ...row,
          status: saved.status,
          latestHandle: saved.latestHandle,
        };
      }),
    );
  }

  private async loadReportedIncidents(tenantId: string): Promise<IncidentVo[]> {
    const keys = await this.redis.scanKeysByMatch(this.buildReportKey(tenantId, '*'), 200, 200);
    if (keys.length === 0) {
      return [];
    }

    const rows = await this.redis.mget(keys);
    return rows.filter(Boolean) as IncidentVo[];
  }

  private filterRows(rows: IncidentVo[], query: IncidentQueryInput): IncidentVo[] {
    const keyword = query.keyword?.trim().toLowerCase();
    return rows.filter(row => {
      if (query.status && row.status !== query.status) return false;
      if (query.type && row.type !== query.type) return false;
      if (query.level && row.level !== query.level) return false;
      if (keyword) {
        const haystack = `${row.title} ${row.message}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });
  }

  private actionToStatus(action: IncidentAction): IncidentStatus {
    if (action === IncidentAction.ACK) return IncidentStatus.ACK;
    if (action === IncidentAction.IGNORE) return IncidentStatus.IGNORED;
    return IncidentStatus.RESOLVED;
  }

  private alertLevelToIncidentLevel(level: 'WARN' | 'CRITICAL'): IncidentLevel {
    if (level === 'CRITICAL') return IncidentLevel.CRITICAL;
    return IncidentLevel.HIGH;
  }

  private stringLevelToIncidentLevel(level?: string): IncidentLevel {
    if (!level) return IncidentLevel.MEDIUM;
    const normalized = level.toUpperCase();
    if (normalized === 'CRITICAL') return IncidentLevel.CRITICAL;
    if (normalized === 'HIGH') return IncidentLevel.HIGH;
    if (normalized === 'LOW') return IncidentLevel.LOW;
    return IncidentLevel.MEDIUM;
  }

  private buildActionKey(tenantId: string, incidentId: string): string {
    return `${this.incidentActionPrefix}:${tenantId}:${incidentId}`;
  }

  private buildReportKey(tenantId: string, incidentId: string): string {
    return `${this.incidentReportPrefix}:${tenantId}:${incidentId}`;
  }
}

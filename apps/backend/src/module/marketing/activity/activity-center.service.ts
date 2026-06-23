import { Injectable } from '@nestjs/common';
import { MktCampaign, MktCampaignStatus } from '@prisma/client';
import { Result } from 'src/common/response/result';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityRepository } from './activity.repository';
import { resolveMarketingActivityStatus, type MarketingActivityStatus } from './activity-status';
import { ActivityQueryDto } from './dto/activity-query.dto';
import { ActivityCalendarQueryDto } from './dto/activity-calendar-query.dto';

type ActivityCenterRow = MktCampaign & {
  tenantName?: string;
  isEnabled: boolean;
  triggerCondition: Record<string, unknown>;
  rules: Record<string, unknown>;
  rewards: Record<string, unknown>;
  status: MarketingActivityStatus;
};

type WindowRange = {
  label: string;
  start: Date;
  end: Date;
};

@Injectable()
export class ActivityCenterService {
  constructor(
    private readonly repo: ActivityRepository,
    private readonly prisma: PrismaService,
  ) {}

  async list(query: ActivityQueryDto) {
    const rows = await this.loadRows(query.type);
    const filtered = this.filterRows(rows, query);
    const pageNum = Math.max(1, Number(query.pageNum ?? 1));
    const pageSize = Math.max(1, Number(query.pageSize ?? 10));
    const start = (pageNum - 1) * pageSize;

    return Result.page(filtered.slice(start, start + pageSize), filtered.length, pageNum, pageSize);
  }

  async calendar(query: ActivityCalendarQueryDto) {
    const rows = await this.loadRows(query.type);
    const filtered = this.filterRows(rows, query);
    const range = this.resolveCalendarRange(query);
    const scheduled = filtered.filter((row) => this.overlapsRange(row, range.start, range.end));
    const days = this.buildCalendarDays(scheduled, range.start, range.end);

    return Result.ok({
      month: range.label,
      days,
      conflicts: days
        .filter((day) => day.hasConflict)
        .map((day) => ({
          date: day.date,
          count: day.total,
          activityIds: day.items.map((item) => item.id),
        })),
    });
  }

  async dashboard(query: ActivityCalendarQueryDto) {
    const rows = await this.loadRows(query.type);
    const filtered = this.filterRows(rows, query);
    const range = this.resolveOptionalRange(query);
    const scopedRows = range
      ? filtered.filter((row) => this.isWithinTrendRange(this.getTrendDate(row), range.start, range.end))
      : filtered;

    return Result.ok({
      summary: this.buildSummary(scopedRows),
      trend: this.buildTrend(scopedRows),
    });
  }

  private async loadRows(type?: string): Promise<ActivityCenterRow[]> {
    const rows = await this.repo.findCenterRows({ type });
    if (rows.length === 0) return [];

    const tenantIds = [...new Set(rows.map((row) => row.tenantId))];
    const tenants = await this.prisma.sysTenant.findMany({
      where: { tenantId: { in: tenantIds } },
      select: { tenantId: true, companyName: true },
    });
    const tenantNameById = new Map(tenants.map((tenant) => [tenant.tenantId, tenant.companyName]));

    return rows.map((row) => {
      const isEnabled = row.status === MktCampaignStatus.PUBLISHED;
      return {
        ...row,
        tenantName: tenantNameById.get(row.tenantId) ?? undefined,
        isEnabled,
        triggerCondition: this.toRecord(row.audienceJson),
        rules: this.toRecord(row.stagesJson),
        rewards: this.toRecord(row.rightsJson),
        status:
          row.status === MktCampaignStatus.ARCHIVED
            ? 'ARCHIVED'
            : resolveMarketingActivityStatus({ startTime: row.startTime, endTime: row.endTime, isEnabled }),
      };
    });
  }

  private filterRows(rows: ActivityCenterRow[], query: Partial<ActivityQueryDto>): ActivityCenterRow[] {
    const keyword = this.normalizeText(query.keyword);
    const ownerKeyword = this.normalizeText(query.ownerUserId);
    const status = this.normalizeText(query.status);
    const startTimeFrom = this.toDate(query.startTimeFrom);
    const startTimeTo = this.toDate(query.startTimeTo);

    return rows.filter((row) => {
      if (keyword) {
        const haystack = this.normalizeText([row.name, row.id, row.tenantId, row.tenantName].filter(Boolean).join(' '));
        if (!haystack.includes(keyword)) {
          return false;
        }
      }

      if (status && row.status !== status.toUpperCase()) {
        return false;
      }

      if (typeof query.isEnabled === 'boolean' && row.isEnabled !== query.isEnabled) {
        return false;
      }

      if (ownerKeyword) {
        const ownerUserId = this.normalizeText(this.readString(this.toRecord(row.audienceJson).ownerUserId));
        if (!ownerUserId.includes(ownerKeyword)) {
          return false;
        }
      }

      if (!this.matchesStartTime(row, startTimeFrom, startTimeTo)) {
        return false;
      }

      return true;
    });
  }

  private buildCalendarDays(rows: ActivityCenterRow[], start: Date, end: Date) {
    const days: Array<{
      date: string;
      total: number;
      hasConflict: boolean;
      items: ActivityCenterRow[];
    }> = [];

    for (let cursor = new Date(start); cursor.getTime() <= end.getTime(); cursor = this.addDays(cursor, 1)) {
      const dayStart = new Date(cursor);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(23, 59, 59, 999);
      const items = rows.filter((row) => this.overlapsRange(row, dayStart, dayEnd));

      days.push({
        date: this.formatDate(dayStart),
        total: items.length,
        hasConflict: items.length > 1,
        items,
      });
    }

    return days;
  }

  private buildSummary(rows: ActivityCenterRow[]) {
    return rows.reduce(
      (summary, row) => {
        summary.total += 1;
        if (row.status === 'PUBLISHED') summary.published += 1;
        if (row.status === 'PAUSED') summary.paused += 1;
        if (row.status === 'ARCHIVED') summary.archived += 1;
        if (row.status === 'DRAFT') summary.draft += 1;
        return summary;
      },
      {
        total: 0,
        published: 0,
        paused: 0,
        archived: 0,
        draft: 0,
      },
    );
  }

  private buildTrend(rows: ActivityCenterRow[]) {
    const bucket = new Map<
      string,
      {
        date: string;
        total: number;
        published: number;
        paused: number;
        archived: number;
        draft: number;
      }
    >();

    for (const row of rows) {
      const trendDate = this.getTrendDate(row);
      if (!trendDate) continue;

      const key = this.formatDate(trendDate);
      const current = bucket.get(key) ?? {
        date: key,
        total: 0,
        published: 0,
        paused: 0,
        archived: 0,
        draft: 0,
      };

      current.total += 1;
      if (row.status === 'PUBLISHED') current.published += 1;
      if (row.status === 'PAUSED') current.paused += 1;
      if (row.status === 'ARCHIVED') current.archived += 1;
      if (row.status === 'DRAFT') current.draft += 1;

      bucket.set(key, current);
    }

    return [...bucket.values()].sort((left, right) => left.date.localeCompare(right.date));
  }

  private resolveCalendarRange(query: ActivityCalendarQueryDto): WindowRange {
    if (query.month) {
      const [yearText, monthText] = query.month.split('-');
      const year = Number(yearText);
      const month = Number(monthText);
      const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

      return {
        label: query.month,
        start,
        end,
      };
    }

    const now = new Date();
    const start = this.toDate(query.rangeStart) ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const end = this.toDate(query.rangeEnd) ?? new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);

    return {
      label: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      start,
      end,
    };
  }

  private resolveOptionalRange(query: ActivityCalendarQueryDto): { start: Date; end: Date } | null {
    if (query.month) {
      const range = this.resolveCalendarRange(query);
      return { start: range.start, end: range.end };
    }

    const start = this.toDate(query.rangeStart);
    const end = this.toDate(query.rangeEnd);
    if (!start && !end) return null;

    return {
      start: start ?? new Date('1970-01-01T00:00:00.000Z'),
      end: end ?? new Date('2999-12-31T23:59:59.999Z'),
    };
  }

  private overlapsRange(row: ActivityCenterRow, start: Date, end: Date): boolean {
    const bounds = this.resolveBounds(row);
    if (!bounds) return false;
    return bounds.start.getTime() <= end.getTime() && bounds.end.getTime() >= start.getTime();
  }

  private matchesStartTime(row: ActivityCenterRow, startTimeFrom: Date | null, startTimeTo: Date | null): boolean {
    if (!startTimeFrom && !startTimeTo) return true;
    const startTime = this.toDate(row.startTime);
    if (!startTime) return false;
    if (startTimeFrom && startTime.getTime() < startTimeFrom.getTime()) return false;
    if (startTimeTo && startTime.getTime() > startTimeTo.getTime()) return false;
    return true;
  }

  private resolveBounds(row: ActivityCenterRow): { start: Date; end: Date } | null {
    const start = this.toDate(row.startTime);
    const end = this.toDate(row.endTime);

    if (!start && !end) return null;

    return {
      start: start ?? end!,
      end: end ?? start!,
    };
  }

  private isWithinTrendRange(date: Date | null, start: Date, end: Date): boolean {
    if (!date) return false;
    const time = date.getTime();
    return time >= start.getTime() && time <= end.getTime();
  }

  private getTrendDate(row: ActivityCenterRow): Date | null {
    return this.toDate(row.startTime) ?? this.toDate(row.createTime);
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeText(value: unknown): string {
    const text = this.readString(value);
    return text ? text.toLowerCase() : '';
  }

  private toDate(value: Date | string | null | undefined): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

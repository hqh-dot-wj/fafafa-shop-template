import { Injectable } from '@nestjs/common';
import { UserMarketingContext } from '../dto/user-marketing-context.dto';

export interface ActivityOfferCandidate {
  templateCode: string;
  status: string;
  rules: Record<string, unknown>;
}

@Injectable()
export class OfferEligibilityService {
  /**
   * 校验活动在当前用户上下文下是否可用：
   * - 活动状态
   * - 时间窗口
   * - 新客/会员等级
   * - 渠道与地区
   * - 库存
   */
  check(candidate: ActivityOfferCandidate, ctx: UserMarketingContext): boolean {
    if (candidate.status !== 'ON_SHELF') {
      return false;
    }

    const rules = candidate.rules;
    if (!this.inTimeWindow(rules, ctx.now)) {
      return false;
    }
    if (!this.passNewcomerRule(rules, candidate.templateCode, ctx)) {
      return false;
    }
    if (!this.passMemberLevelRule(rules, ctx)) {
      return false;
    }
    if (!this.passChannelRule(rules, ctx)) {
      return false;
    }
    if (!this.passRegionRule(rules, ctx)) {
      return false;
    }
    if (!this.passStockRule(rules)) {
      return false;
    }
    return true;
  }

  private inTimeWindow(rules: Record<string, unknown>, now: Date): boolean {
    const start = this.toDate(rules.startTime);
    const end = this.toDate(rules.endTime);
    if (start && start > now) return false;
    if (end && end < now) return false;
    return true;
  }

  private passNewcomerRule(rules: Record<string, unknown>, templateCode: string, ctx: UserMarketingContext): boolean {
    const newcomerOnly = this.toBoolean(rules.newcomerOnly) ?? templateCode === 'NEWCOMER';
    if (!newcomerOnly) {
      return true;
    }
    return Boolean(ctx.isNewcomer);
  }

  private passMemberLevelRule(rules: Record<string, unknown>, ctx: UserMarketingContext): boolean {
    const levels = this.toStringList(rules.memberLevels);
    if (levels.length === 0) {
      return true;
    }
    const current = String(ctx.memberLevel ?? '').trim();
    return current !== '' && levels.includes(current);
  }

  private passChannelRule(rules: Record<string, unknown>, ctx: UserMarketingContext): boolean {
    const channels = this.toStringList(rules.channels).map((item) => item.toUpperCase());
    if (channels.length === 0) {
      return true;
    }
    return channels.includes(ctx.channel.toUpperCase());
  }

  private passRegionRule(rules: Record<string, unknown>, ctx: UserMarketingContext): boolean {
    const regions = this.toStringList(rules.regionCodes);
    if (regions.length === 0) {
      return true;
    }
    const region = String(ctx.regionCode ?? '').trim();
    return region !== '' && regions.includes(region);
  }

  private passStockRule(rules: Record<string, unknown>): boolean {
    const remaining = this.toNumber(rules.remainingStock);
    if (remaining !== null) {
      return remaining > 0;
    }
    const total = this.toNumber(rules.totalStock);
    if (total !== null) {
      return total > 0;
    }
    return true;
  }

  private toDate(value: unknown): Date | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value !== 'string' || !value.trim()) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
      if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    }
    return null;
  }

  private toStringList(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    if (typeof value === 'string' && value.trim()) {
      return [value.trim()];
    }
    return [];
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }
}

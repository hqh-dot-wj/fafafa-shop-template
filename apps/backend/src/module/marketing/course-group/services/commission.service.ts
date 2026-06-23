import { Injectable } from '@nestjs/common';

export type CommissionView = {
  commissionMode: string;
  commissionRate: number | null;
  revenueHint: string;
  shareTitle: string;
};

@Injectable()
export class CommissionService {
  buildCommissionView(rules: Record<string, unknown>): CommissionView {
    const commissionMode = this.readString(rules.commissionMode) ?? 'RATE';
    const commissionRate = this.readNumber(rules.commissionRate ?? rules.rate ?? null);
    const revenueHint =
      this.readString(rules.revenueHint) ??
      (commissionRate != null
        ? `成团后按${(commissionRate * 100).toFixed(0)}%佣金比例结算`
        : '成团后按团长分佣规则结算');
    const shareTitle = this.readString(rules.shareTitle) ?? '邀请你一起拼课';

    return {
      commissionMode,
      commissionRate,
      revenueHint,
      shareTitle,
    };
  }

  calculateCommissionAmount(amount: number, rules: Record<string, unknown>): number | null {
    const view = this.buildCommissionView(rules);
    if (view.commissionRate == null || !Number.isFinite(amount)) {
      return null;
    }
    return Number((amount * view.commissionRate).toFixed(2));
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private readNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }
}

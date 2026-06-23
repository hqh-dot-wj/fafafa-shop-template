import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_TIMEOUT_MINUTES = 30;
const DEFAULT_CANCEL_REASON = '超时未支付自动关闭';
const DEFAULT_SWEEP_BATCH_SIZE = 100;
const DEFAULT_SWEEP_LOCK_TTL_MS = 55_000;

export interface OrderAutoCancelOptions {
  timeoutMinutes: number;
  timeoutMs: number;
  reason: string;
  sweepBatchSize: number;
  sweepLockTtlMs: number;
}

@Injectable()
export class OrderAutoCancelConfigService {
  constructor(private readonly configService: ConfigService) {}

  getOptions(): OrderAutoCancelOptions {
    const timeoutMinutes = this.readInt('ORDER_UNPAID_TIMEOUT_MINUTES', DEFAULT_TIMEOUT_MINUTES, 1, 1440);
    return {
      timeoutMinutes,
      timeoutMs: timeoutMinutes * 60 * 1000,
      reason: this.readReason(),
      sweepBatchSize: this.readInt('ORDER_UNPAID_AUTO_CANCEL_SWEEP_BATCH_SIZE', DEFAULT_SWEEP_BATCH_SIZE, 1, 500),
      sweepLockTtlMs: DEFAULT_SWEEP_LOCK_TTL_MS,
    };
  }

  private readReason() {
    const raw = this.configService.get<string>('ORDER_UNPAID_AUTO_CANCEL_REASON')?.trim();
    return raw || DEFAULT_CANCEL_REASON;
  }

  private readInt(key: string, fallback: number, min: number, max: number) {
    const raw = this.configService.get<string | number>(key);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;

    const normalized = Math.trunc(parsed);
    if (normalized < min) return min;
    if (normalized > max) return max;
    return normalized;
  }
}

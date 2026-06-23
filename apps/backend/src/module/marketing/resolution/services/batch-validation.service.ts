import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from 'src/common/utils/error';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';
import { BatchLockService } from './batch-lock.service';
import { ResolvedActivityContextVo } from '../vo/resolved-activity-context.vo';
import { ValidateActivityDto } from '../dto/validate-activity.dto';

export interface BatchValidateAndLockLine {
  tenantId: string;
  memberId: string;
  productId: string;
  skuId: string;
  activityContextKey?: string | null;
  scene?: string;
}

const DEFAULT_BATCH_VALIDATE_CONCURRENCY = 6;
const MAX_BATCH_VALIDATE_CONCURRENCY = 20;

@Injectable()
export class BatchValidationService {
  private readonly logger = new Logger(BatchValidationService.name);

  constructor(private readonly batchLockService: BatchLockService) {}

  async validateAndLockLines(
    lines: BatchValidateAndLockLine[],
    options: {
      concurrency?: number;
      onItemFailed?: (error: unknown, line: BatchValidateAndLockLine, index: number) => void;
    } = {},
  ): Promise<Array<ResolvedActivityContextVo | null>> {
    const results: Array<ResolvedActivityContextVo | null> = lines.map((): ResolvedActivityContextVo | null => null);
    const indicesNeeding = lines
      .map((line, idx) => ({ idx, line }))
      .filter(({ line }) => Boolean(line.activityContextKey));
    const concurrency = this.clampConcurrency(options.concurrency);

    for (let i = 0; i < indicesNeeding.length; i += concurrency) {
      const chunk = indicesNeeding.slice(i, i + concurrency);
      await Promise.all(
        chunk.map(async ({ idx, line }) => {
          try {
            results[idx] = await this.batchLockService.validateAndLock(this.toValidateActivityDto(line));
          } catch (error) {
            if (this.shouldRejectTokenError(error)) {
              throw error;
            }
            this.logger.warn(`批量活动校验失败，回退原价: ${getErrorMessage(error)}`);
            options.onItemFailed?.(error, line, idx);
            results[idx] = null;
          }
        }),
      );
    }

    return results;
  }

  private clampConcurrency(candidate: number | undefined): number {
    if (!Number.isFinite(candidate)) {
      return DEFAULT_BATCH_VALIDATE_CONCURRENCY;
    }
    const value = Math.trunc(Number(candidate));
    return Math.min(MAX_BATCH_VALIDATE_CONCURRENCY, Math.max(1, value));
  }

  private toValidateActivityDto(line: BatchValidateAndLockLine): ValidateActivityDto {
    return {
      tenantId: line.tenantId,
      memberId: line.memberId,
      productId: line.productId,
      skuId: line.skuId,
      activityContextKey: line.activityContextKey,
      scene: line.scene,
    };
  }

  private shouldRejectTokenError(error: unknown): boolean {
    if (!(error instanceof BusinessException)) {
      return false;
    }
    return error.errorCode === ResponseCode.TOKEN_INVALID || error.errorCode === ResponseCode.TOKEN_EXPIRED;
  }
}

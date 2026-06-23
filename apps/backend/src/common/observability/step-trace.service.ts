import { Injectable } from '@nestjs/common';
import { getErrorMessage } from 'src/common/utils/error';
import { attachErrorContext, ErrorObservabilityContext } from './error-context';
import { ErrorEventService } from './error-event.service';

export interface StepTraceContext extends ErrorObservabilityContext {
  operationCode: string;
  stepCode: string;
  stepName: string;
  optional?: boolean;
}

@Injectable()
export class StepTraceService {
  constructor(private readonly errorEventService: ErrorEventService) {}

  async run<T>(context: StepTraceContext, task: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    try {
      const result = await task();
      await this.errorEventService.recordStep({
        app: 'backend',
        requestId: context.requestId,
        traceId: context.traceId,
        tenantId: context.tenantId,
        userId: context.userId,
        module: context.module,
        operationCode: context.operationCode,
        stepCode: context.stepCode,
        stepName: context.stepName,
        status: 'SUCCESS',
        durationMs: Date.now() - startedAt,
        metadata: context.metadata,
      });
      return result;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      attachErrorContext(error, {
        ...context,
        durationMs,
        level: context.optional ? 'warn' : context.level || 'error',
        safeMessage: context.safeMessage || `${context.stepName}失败`,
        technicalMessage: getErrorMessage(error),
        source: context.source || 'step',
      });
      const errorId = await this.errorEventService.recordException(error, {
        ...context,
        durationMs,
        level: context.optional ? 'warn' : context.level || 'error',
        safeMessage: context.safeMessage || `${context.stepName}失败`,
        source: context.source || 'step',
      });
      await this.errorEventService.recordStep({
        app: 'backend',
        requestId: context.requestId,
        traceId: context.traceId,
        errorId,
        tenantId: context.tenantId,
        userId: context.userId,
        module: context.module,
        operationCode: context.operationCode,
        stepCode: context.stepCode,
        stepName: context.stepName,
        status: 'FAILED',
        message: getErrorMessage(error),
        durationMs,
        metadata: context.metadata,
      });
      throw error;
    }
  }
}

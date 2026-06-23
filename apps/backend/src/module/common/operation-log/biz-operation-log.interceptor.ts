import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable, from, of } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { BizOperationLogService } from './biz-operation-log.service';
import { LOG_OPERATION_META_KEY, type LogOperationMeta } from './log-operation.meta';

@Injectable()
export class BizOperationLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly bizOperationLogService: BizOperationLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<LogOperationMeta | undefined>(LOG_OPERATION_META_KEY, context.getHandler());
    if (!meta) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      mergeMap((resultData: unknown) => {
        if (!this.isSuccess(resultData)) {
          return of(resultData);
        }
        return from(
          (async () => {
            try {
              await this.bizOperationLogService.recordFromHttp(meta, req);
            } catch {
              /* 日志失败不阻断主流程 */
            }
            return resultData;
          })(),
        );
      }),
    );
  }

  private isSuccess(data: unknown): boolean {
    return (
      data !== null &&
      typeof data === 'object' &&
      'code' in data &&
      (data as { code: number }).code === 200
    );
  }
}

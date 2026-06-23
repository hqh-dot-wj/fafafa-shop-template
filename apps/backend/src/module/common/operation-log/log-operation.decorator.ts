import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';
import { BizOperationLogInterceptor } from './biz-operation-log.interceptor';
import { LOG_OPERATION_META_KEY, type LogOperationMeta } from './log-operation.meta';

export type { LogOperationMeta } from './log-operation.meta';

/**
 * 业务操作日志：接口返回 Result 成功（code=200）后写入 biz_operation_log
 */
export function LogOperation(meta: LogOperationMeta) {
  return applyDecorators(SetMetadata(LOG_OPERATION_META_KEY, meta), UseInterceptors(BizOperationLogInterceptor));
}

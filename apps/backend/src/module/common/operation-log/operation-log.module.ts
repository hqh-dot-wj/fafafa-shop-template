import { Global, Module } from '@nestjs/common';
import { TenantModule } from 'src/common/tenant/tenant.module';
import { BizOperationLogService } from './biz-operation-log.service';
import { BizOperationLogInterceptor } from './biz-operation-log.interceptor';

/**
 * 业务操作日志模块（全局注册，供各业务 Controller 使用 @LogOperation）
 */
@Global()
@Module({
  imports: [TenantModule],
  providers: [BizOperationLogService, BizOperationLogInterceptor],
  exports: [BizOperationLogService, BizOperationLogInterceptor],
})
export class OperationLogModule {}

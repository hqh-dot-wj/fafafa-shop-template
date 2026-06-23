import { Module, Global, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './config/app-config.service';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import configuration from './config/index';
import { validate } from './config/env.validation';
import { AppConfigModule } from './config/app-config.module';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtAuthGuard } from 'src/module/admin/common/guards/auth.guard';
import { PermissionGuard } from 'src/module/admin/common/guards/permission.guard';
import { RolesGuard } from 'src/module/admin/common/guards/roles.guard';
import { CustomThrottlerGuard } from './common/guards/throttle.guard';
import { TenantMiddleware, TenantGuard, TenantModule } from './common/tenant';
import { CryptoModule, DecryptInterceptor } from './common/crypto';
import { LoggerModule } from './common/logger';
import { ClsModule } from './common/cls';
import { ObservabilityModule } from './common/observability';
import { AuditModule } from './common/audit';
import { TransactionalInterceptor } from './common/interceptors/transactional.interceptor';
import { HttpMetricsInterceptor } from './common/interceptors/http-metrics.interceptor';
import { IdempotentGuard } from './common/guards/idempotent.guard';
import { SchedulerGuardService } from './common/scheduler/scheduler-guard.service';
import { RedisThrottlerStorage } from './common/guards/redis-throttler.storage';

import { MainModule } from './module/main/main.module';
import { AdminModule } from './module/admin/admin.module';
import { CommonModule } from './module/common/common.module';
import { PrismaModule } from './prisma/prisma.module';
import { ClientModule } from './module/client/client.module';
import { LbsModule } from './module/lbs/lbs.module';
import { StoreModule } from './module/store/store.module';
import { PmsModule } from './module/pms/pms.module';
import { FinanceModule } from './module/finance/finance.module';
import { RiskModule } from './module/risk/risk.module';
import { MarketingModule } from './module/marketing/marketing.module';
import { OperationLogModule } from './module/common/operation-log/operation-log.module';
import { MetricsModule } from './module/admin/monitor/metrics/metrics.module';

const parseRateLimitValue = (raw: string | undefined, fallback: number, min: number, max: number): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
};

const DEFAULT_THROTTLER_TTL_MS = parseRateLimitValue(process.env.THROTTLER_TTL_MS, 60_000, 1_000, 86_400_000);
const DEFAULT_THROTTLER_LIMIT = parseRateLimitValue(process.env.THROTTLER_LIMIT, 3_000, 10, 1_000_000);

@Global()
@Module({
  imports: [
    // 配置模块 - 强类型配置验证
    ConfigModule.forRoot({
      cache: true,
      load: [configuration],
      isGlobal: true,
      validate,
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    // 类型安全的配置服务模块
    AppConfigModule,
    // Pino 日志模块
    LoggerModule,
    // CLS 上下文模块 (Request ID)
    ClsModule,
    // 错误监控、链路 ID 与步骤事件
    ObservabilityModule,
    // 审计模块 (租户访问审计)
    AuditModule,
    // 数据库改为 Prisma + PostgreSQL
    PrismaModule,
    // 多租户模块
    TenantModule,
    // 业务操作日志（@LogOperation）
    OperationLogModule,
    // Prometheus 指标（HttpMetricsInterceptor 依赖的 Counter/Histogram 需在本模块上下文可解析）
    MetricsModule,
    // 加解密模块
    CryptoModule,
    // 定时任务模块（全局唯一注册）
    ScheduleModule.forRoot(),
    // 事件驱动模块（全局唯一注册）
    EventEmitterModule.forRoot({
      maxListeners: 20,
      wildcard: true,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
    // API 限流模块
    ThrottlerModule.forRoot([
      {
        ttl: DEFAULT_THROTTLER_TTL_MS,
        limit: DEFAULT_THROTTLER_LIMIT,
      },
    ]),
    // Bull 队列模块 (用于异步任务处理)
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        redis: {
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password,
          db: config.redis.db,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
    }),

    MainModule,
    AdminModule,
    CommonModule,
    ClientModule,
    LbsModule,
    StoreModule,
    RiskModule,
    PmsModule,
    FinanceModule,
    MarketingModule,
  ],
  providers: [
    // 开发环境自动禁用 Cron 定时任务，避免 watch 模式内存泄漏
    SchedulerGuardService,
    // 限流计数使用 Redis，支持多实例一致限流
    {
      provide: ThrottlerStorage,
      useClass: RedisThrottlerStorage,
    },
    // 解密拦截器 (解密前端加密请求)
    {
      provide: APP_INTERCEPTOR,
      useClass: DecryptInterceptor,
    },
    // 事务拦截器 (自动处理 @Transactional 装饰器)
    {
      provide: APP_INTERCEPTOR,
      useClass: TransactionalInterceptor,
    },
    // HTTP 指标拦截器 (统一采集请求量与耗时指标)
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
    // API 限流守卫 - 最先执行，防止DDoS攻击
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    // JWT 认证守卫 - 第二执行，验证用户身份
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // 租户守卫：仅处理 @IgnoreTenant（Repository 等是否忽略租户过滤），不在此重复解析 tenant-id。
    // HTTP 层 tenant-id / 缺省策略由下方 configure 中的 TenantMiddleware 统一处理，二者职责不重叠。
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    // 角色守卫 - 检查用户角色
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // 权限守卫 - 检查API权限
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: IdempotentGuard,
    },
  ],
  controllers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 先于全局 Guard 执行：解析 tenant-id、按路径决定 C 端回落 / 后台 403 / 白名单 exempt
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}

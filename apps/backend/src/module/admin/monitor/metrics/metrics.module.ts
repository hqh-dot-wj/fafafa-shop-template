import { Module } from '@nestjs/common';
import { PrometheusModule, makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';
import { MetricsController } from './metrics.controller';

/** 供 AppModule 中 HttpMetricsInterceptor 注入，须在此模块 exports 中显式导出对应 provider */
const httpRequestsTotal = makeCounterProvider({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
});

const httpRequestDurationSeconds = makeHistogramProvider({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10],
});

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'nest_admin_',
        },
      },
    }),
  ],
  controllers: [MetricsController],
  providers: [
    httpRequestsTotal,
    httpRequestDurationSeconds,
    // 用户登录计数器
    makeCounterProvider({
      name: 'user_login_total',
      help: 'Total number of user logins',
      labelNames: ['tenant_id', 'status'],
    }),

    // 操作日志计数器
    makeCounterProvider({
      name: 'operation_log_total',
      help: 'Total number of operations logged',
      labelNames: ['tenant_id', 'business_type'],
    }),
  ],
  exports: [PrometheusModule, httpRequestsTotal, httpRequestDurationSeconds],
})
export class MetricsModule {}

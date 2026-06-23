import { Module } from '@nestjs/common';
import { ClsModule as NestClsModule } from 'nestjs-cls';
import { createRequestId, createTraceId } from '../observability/error-context';

@Module({
  imports: [
    NestClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (req) => {
          const inboundRequestId = req.headers['x-request-id'];
          const requestId = Array.isArray(inboundRequestId) ? inboundRequestId[0] : inboundRequestId;
          // 优先复用前端传入的 X-Request-Id；没有才生成，保证前后端日志可串联。
          const normalizedRequestId = requestId || createRequestId();
          req['id'] = normalizedRequestId;
          return normalizedRequestId;
        },
        setup: (cls, req, res) => {
          const requestId = cls.getId();
          const inboundTraceId = req.headers['x-trace-id'];
          const traceId =
            (Array.isArray(inboundTraceId) ? inboundTraceId[0] : inboundTraceId) || requestId || createTraceId();

          req['traceId'] = traceId;
          cls.set('requestId', requestId);
          cls.set('traceId', traceId);

          // 将链路 ID 添加到响应头，前端错误提示与客服排查使用同一组 ID。
          res.setHeader('X-Request-ID', requestId);
          res.setHeader('X-Trace-ID', traceId);

          const tenantHeader = req.headers['tenant-id'] || req.headers['x-tenant-id'];
          const tenantId = Array.isArray(tenantHeader) ? tenantHeader[0] : tenantHeader;
          if (tenantId) {
            cls.set('tenantId', tenantId);
          }

          if (req['user']) {
            cls.set('user', req['user']);
          }
        },
      },
    }),
  ],
})
export class ClsModule {}

import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { TenantContext } from '../tenant/tenant.context';
import { ClsService } from 'nestjs-cls';
import { TenantAuditService } from 'src/module/admin/system/tenant-audit/tenant-audit.service';
import { Request } from 'express';

type InterceptorValue = object | string | number | boolean | null;
interface AuditRequest extends Request {
  user?: {
    userId?: string | number;
    userName?: string;
  };
}

interface AuditData {
  userId?: string | number;
  userName?: string;
  userType: 'admin' | 'anonymous';
  requestTenantId: string | undefined;
  isSuperTenant: boolean;
  isIgnoreTenant: boolean;
  ip: string;
  userAgent: string | undefined;
  requestPath: string | undefined;
  requestMethod: string | undefined;
  traceId: string | undefined;
}

/**
 * 租户审计拦截器
 *
 * @description 记录租户数据访问行为,用于安全审计
 */
@Injectable()
export class TenantAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantAuditInterceptor.name);

  constructor(
    private readonly cls: ClsService,
    private readonly tenantAuditService: TenantAuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<InterceptorValue> {
    const request = context.switchToHttp().getRequest<AuditRequest>();
    const startTime = Date.now();

    // 提取审计数据
    const auditData = this.extractAuditData(request);

    // 存储到 CLS,供 Repository 使用
    this.cls.set('AUDIT_DATA', auditData);
    // 注册审计服务到 CLS
    this.cls.set('AUDIT_SERVICE', this.tenantAuditService);

    return next.handle().pipe(
      tap(() => {
        // 成功时记录
        const duration = Date.now() - startTime;
        this.cls.set('AUDIT_DURATION', duration);
        this.cls.set('AUDIT_STATUS', 'success');
      }),
      catchError((error) => {
        // 失败时记录
        const duration = Date.now() - startTime;
        this.cls.set('AUDIT_DURATION', duration);
        this.cls.set('AUDIT_STATUS', 'error');
        this.cls.set('AUDIT_ERROR', error.message || String(error));
        return throwError(() => error);
      }),
    );
  }

  /**
   * 提取审计数据
   */
  private extractAuditData(request: AuditRequest): AuditData {
    const user = request.user;
    const tenantId = TenantContext.getTenantId();
    const isSuperTenant = TenantContext.isSuperTenant();
    const isIgnoreTenant = TenantContext.isIgnoreTenant();

    return {
      userId: user?.userId,
      userName: user?.userName,
      userType: user ? 'admin' : 'anonymous',
      requestTenantId: tenantId,
      isSuperTenant,
      isIgnoreTenant,
      ip: this.getClientIp(request),
      userAgent: this.getHeaderValue(request.headers['user-agent']),
      requestPath: request.url,
      requestMethod: request.method,
      traceId: this.cls.get<string>('traceId') || this.getHeaderValue(request.headers['x-trace-id']),
    };
  }

  private getHeaderValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  /**
   * 获取客户端 IP
   */
  private getClientIp(request: AuditRequest): string {
    const forwardedFor = this.getHeaderValue(request.headers['x-forwarded-for']);
    const realIp = this.getHeaderValue(request.headers['x-real-ip']);

    return (
      forwardedFor?.split(',')[0] || realIp || request.connection?.remoteAddress || request.socket?.remoteAddress || ''
    );
  }
}

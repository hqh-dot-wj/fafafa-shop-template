import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ClsService } from 'nestjs-cls';
import { AppConfigService } from 'src/config/app-config.service';
import { Result, ResponseCode } from 'src/common/response';
import { TenantContext } from './tenant.context';
import { normalizeStrippedPath, resolveTenantPathPolicy } from './tenant-path-policy';

/**
 * 租户中间件 - 从请求中提取租户信息并设置到上下文与 CLS，供积分等依赖租户的逻辑使用
 *
 * 策略（启用多租户时）：
 * - 已解析到 tenant-id：写入上下文
 * - C 端等路径（见 tenant-path-policy）：未带头则回落超级租户
 * - 全局/登录前白名单路径：未带头则回落超级租户
 * - 其余后台路径：未带头返回 403
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(
    private config: AppConfigService,
    private cls: ClsService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    if (req.method === 'OPTIONS') {
      this.runWithTenant(TenantContext.SUPER_TENANT_ID, req, next);
      return;
    }

    const tenantEnabled = this.config.tenant.enabled;

    if (!tenantEnabled) {
      this.runWithTenant(TenantContext.SUPER_TENANT_ID, req, next);
      return;
    }

    const extracted = this.extractTenantId(req);
    if (extracted) {
      this.logger.debug(`Request tenant: ${extracted}`);
      this.runWithTenant(extracted, req, next);
      return;
    }

    const stripped = normalizeStrippedPath(req.originalUrl, req.url, this.config.app.prefix || '');
    const policy = resolveTenantPathPolicy(
      stripped,
      req.method,
      this.config.perm.router.whitelist,
      this.config.tenant.exemptPathPrefixes,
    );

    if (policy === 'strict_admin') {
      res
        .status(403)
        .json(Result.fail(ResponseCode.FORBIDDEN, '后台接口请在请求头携带 tenant-id（或 query tenantId）'));
      return;
    }

    this.runWithTenant(TenantContext.SUPER_TENANT_ID, req, next);
  }

  private runWithTenant(tenantId: string, _req: Request, next: NextFunction) {
    TenantContext.run({ tenantId }, () => {
      try {
        if (this.cls.isActive()) {
          this.cls.set('tenantId', tenantId);
        }
      } catch {
        // CLS 上下文不可用时仅依赖 TenantContext，下游用 TenantContext.getTenantId() 即可
      }
      next();
    });
  }

  /**
   * 从请求中提取租户ID
   * 支持多种方式：header、query、subdomain
   */
  private extractTenantId(req: Request): string | undefined {
    // 1. 从 header 获取 (优先级最高)
    // Soybean 前端使用 'tenant-id' header
    const headerTenantId = req.headers['tenant-id'] as string;
    if (headerTenantId) {
      return headerTenantId;
    }

    // 2. 从 query 参数获取
    const queryTenantId = req.query['tenantId'] as string;
    if (queryTenantId) {
      return queryTenantId;
    }

    // 3. 从子域名获取 (可选，用于 SaaS 场景)
    // 例如: tenant1.example.com -> tenant1
    const host = req.headers.host;
    if (host) {
      const subdomain = this.extractSubdomain(host);
      if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
        // 需要查询数据库将域名映射为租户ID，这里简化处理
        // 实际项目中可以缓存这个映射关系
        return undefined;
      }
    }

    return undefined;
  }

  /**
   * 从 host 中提取子域名
   */
  private extractSubdomain(host: string): string | undefined {
    const parts = host.split('.');
    if (parts.length >= 3) {
      return parts[0];
    }
    return undefined;
  }
}

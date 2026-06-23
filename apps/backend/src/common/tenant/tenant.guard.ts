import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppConfigService } from 'src/config/app-config.service';
import { IGNORE_TENANT_KEY } from './tenant.decorator';
import { TenantContext } from './tenant.context';

/**
 * 租户守卫
 *
 * 职责：
 * 1. 默认放行（return true）—— 不做权限拦截，权限由 JwtAuthGuard 与 PermissionGuard 负责
 * 2. 处理 @IgnoreTenant 装饰器，设置 TenantContext.ignoreTenant 标志
 * 3. 单实例单租户模板模式兜底：若 TenantContext 已 run 但 tenantId 缺失（异常路径），
 *    自动注入 SUPER_TENANT_ID('000000')，避免下游 Repository 因 tenantId 缺失走"无过滤"分支
 *
 * 说明（FAFAFA-PIVOT-PHASE2-2026-06）：
 * - 主链路 tenantId 注入由 TenantMiddleware 完成（每个分支都 runWithTenant(...) 包裹）
 * - Guard 仅负责兜底 + IgnoreTenant，不应承载主注入逻辑
 * - 已知非目标：tenant.middleware.ts 的 strict_admin → 403 分支仍存在；admin-web 仍带 tenant-id
 *   头，行为兼容；彻底放开 admin 路径未带头需求由后续 Phase 处理
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(
    private reflector: Reflector,
    private config: AppConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const tenantEnabled = this.config.tenant.enabled;
    if (!tenantEnabled) {
      return true;
    }

    const ignoreTenant = this.reflector.getAllAndOverride<boolean>(IGNORE_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (ignoreTenant) {
      TenantContext.setIgnoreTenant(true);
      this.logger.debug('Tenant filtering ignored for this request');
    }

    // 单实例单租户兜底：上游 Middleware 未能注入 tenantId 时（理论上不应发生），
    // 直接写入超级租户 ID，保证下游 Repository 始终能拿到一致的租户上下文
    if (TenantContext.getStore() && !TenantContext.getTenantId()) {
      TenantContext.setTenantId(TenantContext.SUPER_TENANT_ID);
      this.logger.debug(`Tenant context fallback to ${TenantContext.SUPER_TENANT_ID}`);
    }

    return true;
  }
}

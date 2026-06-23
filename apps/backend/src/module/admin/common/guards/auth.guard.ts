import { Reflector } from '@nestjs/core';
import { AppConfigService } from 'src/config/app-config.service';
import { AuthGuard } from '@nestjs/passport';
import { pathToRegexp } from 'path-to-regexp';
import { ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import { UserService } from 'src/module/admin/system/user/user.service';
import { normalizeStrippedPath } from 'src/common/tenant/tenant-path-policy';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private globalWhiteList: Array<{ method?: string; path: string }> = [];
  constructor(
    private readonly reflector: Reflector,
    @Inject(UserService)
    private readonly userService: UserService,
    private readonly config: AppConfigService,
  ) {
    super();
    this.globalWhiteList = [].concat(this.config.perm.router.whitelist || []);
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const notRequireAuth = this.reflector.getAllAndOverride('notRequireAuth', [ctx.getClass(), ctx.getHandler()]);

    if (notRequireAuth) {
      await this.jumpActivate(ctx);
      return true;
    }

    // 仅小程序 C 端模块（去掉全局 prefix 后以 /client 开头）放行，由 Member 侧 Guard 处理。
    // 禁止用 includes('/client/')：会误判后台「OAuth 客户端」路由 /system/client/*。
    const req = ctx.switchToHttp().getRequest();
    const pathSource =
      (typeof req.originalUrl === 'string' && req.originalUrl) ||
      (typeof req.url === 'string' && req.url) ||
      (typeof req.path === 'string' && req.path) ||
      (typeof req.route?.path === 'string' ? req.route.path : undefined);
    const strippedPath = normalizeStrippedPath(pathSource, pathSource, this.config.app.prefix);
    if (strippedPath === '/client' || strippedPath.startsWith('/client/')) {
      return true;
    }

    const isInWhiteList = this.checkWhiteList(ctx);
    if (isInWhiteList) {
      await this.jumpActivate(ctx);
      return true;
    }

    const accessToken = req.get('Authorization');

    if (!accessToken) throw new ForbiddenException('请重新登录');
    const atUserId = await this.userService.parseToken(accessToken);
    if (!atUserId) throw new UnauthorizedException('当前登录已过期，请重新登录');
    return await this.activate(ctx);
  }

  async activate(ctx: ExecutionContext) {
    return super.canActivate(ctx) as boolean;
  }

  /**
   * 跳过验证
   * @param ctx
   * @returns
   */
  async jumpActivate(ctx: ExecutionContext) {
    try {
      await this.activate(ctx);
    } catch {
      // 未登录不做任何处理，直接返回 true
    }

    return true;
  }

  /**
   * 检查接口是否在白名单内
   * @param ctx
   * @returns
   */
  checkWhiteList(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const routePath = req.route?.path ?? req.path ?? '';
    const i = this.globalWhiteList.findIndex((route) => {
      // 请求方法类型相同
      if (!route.method || req.method.toUpperCase() === route.method.toUpperCase()) {
        // 对比 url
        return !!pathToRegexp(route.path).exec(routePath);
      }
      return false;
    });
    // 在白名单内 则 进行下一步， i === -1 ，则不在白名单，需要 比对是否有当前接口权限
    return i > -1;
  }
}

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();

    const role = this.reflector.getAllAndOverride('role', [ctx.getClass(), ctx.getHandler()]);

    if (!role) {
      return true;
    }

    return this.hasRole(role, req.user?.roles, req.user?.permissions);
  }

  hasRole(role: string, roles: string[] | undefined, permissions?: string[] | undefined) {
    if (Array.isArray(permissions) && permissions.includes('*:*:*')) {
      return true;
    }
    if (!Array.isArray(roles)) {
      return false;
    }
    return roles.some((v) => v === role);
  }
}

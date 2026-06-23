import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { PermissionGuard } from './permission.guard';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionGuard(reflector);
  });

  describe('canActivate', () => {
    it('未登录（req.user 缺失）且接口要求权限时应返回 false 而非抛错', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('system:client:list');

      const context = {
        switchToHttp: () => ({
          getRequest: () => ({ user: undefined }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      await expect(guard.canActivate(context)).resolves.toBe(false);
    });
  });

  describe('hasPermission', () => {
    it('权限列表缺失时应返回 false 而非抛错', () => {
      expect(guard.hasPermission('lbs:region:list', undefined)).toBe(false);
      expect(guard.hasPermission('lbs:region:list', null as unknown as string[] | undefined)).toBe(false);
    });

    it('空数组应返回 false', () => {
      expect(guard.hasPermission('lbs:region:list', [])).toBe(false);
    });

    it('匹配具体权限或 *:*:*', () => {
      expect(guard.hasPermission('lbs:region:list', ['lbs:region:list'])).toBe(true);
      expect(guard.hasPermission('lbs:region:list', ['*:*:*'])).toBe(true);
      expect(guard.hasPermission('lbs:region:list', ['other:perm'])).toBe(false);
    });
  });
});

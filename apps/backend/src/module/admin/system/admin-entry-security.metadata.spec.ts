import 'reflect-metadata';
import { RoleController } from './role/role.controller';
import { TenantController } from './tenant/tenant.controller';
import { UserController } from './user/user.controller';

type ControllerClass = new (...args: never[]) => unknown;

function methodMetadata<T>(controller: ControllerClass, methodName: string, key: string): T | undefined {
  const method = controller.prototype[methodName] as (...args: unknown[]) => unknown;
  return Reflect.getMetadata(key, method) as T | undefined;
}

function expectPermission(controller: ControllerClass, methodName: string, permission: string) {
  expect(methodMetadata<string>(controller, methodName, 'permission')).toBe(permission);
}

function expectRole(controller: ControllerClass, methodName: string, role: string) {
  expect(methodMetadata<string>(controller, methodName, 'role')).toBe(role);
}

describe('admin system controller entry security metadata', () => {
  describe('invariants', () => {
    it.each([
      ['RoleController.create', RoleController, 'create', 'system:role:add'],
      ['RoleController.findAll', RoleController, 'findAll', 'system:role:list'],
      ['RoleController.findOne', RoleController, 'findOne', 'system:role:query'],
      ['RoleController.update', RoleController, 'update', 'system:role:edit'],
      ['RoleController.dataScope', RoleController, 'dataScope', 'system:role:edit'],
      ['RoleController.changeStatus', RoleController, 'changeStatus', 'system:role:edit'],
      ['RoleController.remove', RoleController, 'remove', 'system:role:remove'],
      ['RoleController.authUserSelectAll', RoleController, 'authUserSelectAll', 'system:role:edit'],
      ['RoleController.exportData', RoleController, 'exportData', 'system:role:export'],
    ])('%s has required permission metadata', (_label, controller, methodName, permission) => {
      expectPermission(controller, methodName, permission);
    });

    it.each([
      ['UserController.profile', UserController, 'profile', 'system:user:query'],
      ['UserController.create', UserController, 'create', 'system:user:add'],
      ['UserController.findAll', UserController, 'findAll', 'system:user:list'],
      ['UserController.findOne', UserController, 'findOne', 'system:user:query'],
      ['UserController.update', UserController, 'update', 'system:user:edit'],
      ['UserController.resetPwd', UserController, 'resetPwd', 'system:user:resetPwd'],
      ['UserController.remove', UserController, 'remove', 'system:user:remove'],
      ['UserController.exportData', UserController, 'exportData', 'system:user:export'],
    ])('%s has required permission metadata', (_label, controller, methodName, permission) => {
      expectPermission(controller, methodName, permission);
    });

    it.each([
      ['TenantController.create', TenantController, 'create', 'system:tenant:add'],
      ['TenantController.findAll', TenantController, 'findAll', 'system:tenant:list'],
      ['TenantController.findOne', TenantController, 'findOne', 'system:tenant:query'],
      ['TenantController.update', TenantController, 'update', 'system:tenant:edit'],
      ['TenantController.remove', TenantController, 'remove', 'system:tenant:remove'],
      ['TenantController.dynamicTenant', TenantController, 'dynamicTenant', 'system:tenant:dynamic'],
      ['TenantController.clearDynamicTenant', TenantController, 'clearDynamicTenant', 'system:tenant:dynamic'],
      ['TenantController.exportData', TenantController, 'exportData', 'system:tenant:export'],
    ])('%s has required permission metadata', (_label, controller, methodName, permission) => {
      expectPermission(controller, methodName, permission);
    });
  });

  describe('adversarial inputs', () => {
    it.each([
      ['UserController.authRole', 'authRole'],
      ['UserController.updateAuthRole', 'updateAuthRole'],
      ['UserController.changeStatus', 'changeStatus'],
    ])('%s is restricted to admin role instead of ordinary permission strings', (_label, methodName) => {
      expectRole(UserController, methodName, 'admin');
    });
  });

  describe('boundary conditions', () => {
    it('does not mark tenant dynamic switch endpoints as public', () => {
      expect(methodMetadata<boolean>(TenantController, 'dynamicTenant', 'notRequireAuth')).toBeUndefined();
      expect(methodMetadata<boolean>(TenantController, 'clearDynamicTenant', 'notRequireAuth')).toBeUndefined();
    });
  });
});

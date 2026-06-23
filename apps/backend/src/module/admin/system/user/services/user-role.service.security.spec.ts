import { UserRoleService } from './user-role.service';
import { ResponseCode } from 'src/common/response';

const tenantHelper = {
  readWhereForDelegate: (_delegateKey: string, where?: object) => ({ ...(where ?? {}) }),
};

describe('UserRoleService authorization invariants', () => {
  let service: UserRoleService;
  let prisma: Record<string, any>;

  beforeEach(() => {
    prisma = {
      sysDept: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      sysUser: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      sysUserRole: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((input: unknown[] | ((tx: Record<string, any>) => Promise<unknown>)) => {
        if (typeof input === 'function') {
          return input(prisma);
        }
        return Promise.all(input);
      }),
    };

    service = new UserRoleService(prisma as any, {} as any, {} as any, tenantHelper as any);
  });

  describe('updateAuthRole', () => {
    it('rejects role updates for the built-in system user', async () => {
      const result = await service.updateAuthRole({ userId: 1, roleIds: '2,3' });

      expect(result.code).toBe(ResponseCode.BUSINESS_ERROR);
      expect(result.msg).toContain('系统用户角色不可变更');
      expect(prisma.sysUserRole.deleteMany).not.toHaveBeenCalled();
      expect(prisma.sysUserRole.createMany).not.toHaveBeenCalled();
    });

    it('filters super-admin, duplicate, and invalid role ids before creating relations', async () => {
      const result = await service.updateAuthRole({ userId: 2, roleIds: '1,2,2,abc,3,0' });

      expect(result.code).toBe(200);
      expect(prisma.sysUserRole.deleteMany).toHaveBeenCalledWith({ where: { userId: 2 } });
      expect(prisma.sysUserRole.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 2, roleId: 2 },
          { userId: 2, roleId: 3 },
        ],
        skipDuplicates: true,
      });
    });

    it('clears old roles when only super-admin or invalid role ids are submitted', async () => {
      const result = await service.updateAuthRole({ userId: 2, roleIds: '1,abc,0' });

      expect(result.code).toBe(200);
      expect(prisma.sysUserRole.deleteMany).toHaveBeenCalledWith({ where: { userId: 2 } });
      expect(prisma.sysUserRole.createMany).not.toHaveBeenCalled();
    });
  });

  describe('authUserSelectAll', () => {
    it('rejects batch granting the super-admin role', async () => {
      const result = await service.authUserSelectAll({ roleId: 1, userIds: '2,3' });

      expect(result.code).toBe(ResponseCode.BUSINESS_ERROR);
      expect(result.msg).toContain('超级管理员角色不可授权');
      expect(prisma.sysUserRole.createMany).not.toHaveBeenCalled();
    });

    it('deduplicates user ids before batch granting a normal role', async () => {
      const result = await service.authUserSelectAll({ roleId: 2, userIds: '2,2,3,abc,0' });

      expect(result.code).toBe(200);
      expect(prisma.sysUserRole.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 2, roleId: 2 },
          { userId: 3, roleId: 2 },
        ],
        skipDuplicates: true,
      });
    });

    it('treats an empty user id list as an idempotent no-op', async () => {
      const result = await service.authUserSelectAll({ roleId: 2, userIds: 'abc,0' });

      expect(result.code).toBe(200);
      expect(prisma.sysUserRole.createMany).not.toHaveBeenCalled();
    });
  });

  describe('authUserCancelAll', () => {
    it('deduplicates user ids before batch canceling role grants', async () => {
      const result = await service.authUserCancelAll({ roleId: 2, userIds: '2,2,3,abc,0' });

      expect(result.code).toBe(200);
      expect(prisma.sysUserRole.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: { in: [2, 3] },
          roleId: 2,
        },
      });
    });

    it('treats an empty cancel list as an idempotent no-op', async () => {
      const result = await service.authUserCancelAll({ roleId: 2, userIds: 'abc,0' });

      expect(result.code).toBe(200);
      expect(prisma.sysUserRole.deleteMany).not.toHaveBeenCalled();
    });
  });
});

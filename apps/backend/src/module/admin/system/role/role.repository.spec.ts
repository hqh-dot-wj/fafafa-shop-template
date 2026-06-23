import { ClsService } from 'nestjs-cls';
import { DelFlagEnum } from 'src/common/enum/index';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { PrismaService } from 'src/prisma/prisma.service';
import { RoleRepository } from './role.repository';

describe('RoleRepository', () => {
  it('findPageWithMenuCount 对 sysRoleMenu.groupBy 仅使用 roleId 条件，不含 delFlag', async () => {
    const findMany = jest.fn().mockResolvedValue([{ roleId: 7 }, { roleId: 8 }]);
    const count = jest.fn().mockResolvedValue(2);
    const groupBy = jest.fn().mockResolvedValue([
      { roleId: 7, _count: { menuId: 3 } },
      { roleId: 8, _count: { menuId: 1 } },
    ]);
    const prisma = {
      sysRole: { findMany, count },
      sysRoleMenu: { groupBy },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    } as unknown as PrismaService;

    const cls = {
      get: jest.fn().mockReturnValue(undefined),
      isActive: jest.fn(() => true),
    } as unknown as ClsService;

    await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID }, async () => {
      const repo = new RoleRepository(prisma, cls);
      const { list, total } = await repo.findPageWithMenuCount({ delFlag: DelFlagEnum.NORMAL }, 0, 10, {
        roleSort: 'asc',
      });
      expect(total).toBe(2);
      expect(list).toHaveLength(2);
      expect(list[0]?.menuCount).toBe(3);
    });

    expect(groupBy).toHaveBeenCalledWith({
      by: ['roleId'],
      where: { roleId: { in: [7, 8] } },
      _count: { menuId: true },
    });
  });

  it('findPageWithMenuCount 在当页无角色时不调用 groupBy', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const groupBy = jest.fn();
    const prisma = {
      sysRole: { findMany, count },
      sysRoleMenu: { groupBy },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    } as unknown as PrismaService;

    const cls = {
      get: jest.fn().mockReturnValue(undefined),
      isActive: jest.fn(() => true),
    } as unknown as ClsService;

    await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID }, async () => {
      const repo = new RoleRepository(prisma, cls);
      await repo.findPageWithMenuCount({ delFlag: DelFlagEnum.NORMAL }, 0, 10);
    });

    expect(groupBy).not.toHaveBeenCalled();
  });
});

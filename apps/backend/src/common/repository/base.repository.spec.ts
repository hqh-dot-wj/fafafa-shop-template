import { ClsService } from 'nestjs-cls';
import { PrismaClient } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { TenantContext } from '../tenant/tenant.context';
import { PrismaService } from '../../prisma/prisma.service';

type TestDelegate = {
  findMany: jest.Mock;
  count: jest.Mock;
};

class TestRepository extends BaseRepository<{ id: string }, object, object, TestDelegate> {
  constructor(prisma: PrismaService, cls: ClsService) {
    super(prisma, cls, 'sysUser' as keyof PrismaClient);
  }
}

function createMocks() {
  const findMany = jest.fn().mockResolvedValue([]);
  const count = jest.fn().mockResolvedValue(0);
  const prisma = { sysUser: { findMany, count } } as unknown as PrismaService;
  const cls = {
    get: jest.fn().mockReturnValue(undefined),
  } as unknown as ClsService;
  return { prisma, cls, findMany, count };
}

describe('BaseRepository tenant scope (findMany / count)', () => {
  it('findMany merges tenantId when in normal tenant context', async () => {
    const { prisma, cls, findMany } = createMocks();
    await TenantContext.run({ tenantId: '100001' }, async () => {
      const repo = new TestRepository(prisma, cls);
      await repo.findMany({ where: { status: '0' }, take: 5 });
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: '100001', status: '0' }),
        take: 5,
      }),
    );
  });

  it('findMany injects tenantId for super tenant in single-tenant fallback mode', async () => {
    // FAFAFA-PIVOT-PHASE2-2026-06：移除"超级租户短路"分支后，'000000' 也走 tenantId 过滤
    // 单实例单租户模板模式下，所有 tenantId 都是 '000000'，过滤始终生效（行为与现状等价）
    const { prisma, cls, findMany } = createMocks();
    await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID }, async () => {
      const repo = new TestRepository(prisma, cls);
      await repo.findMany({ where: { status: '0' } });
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TenantContext.SUPER_TENANT_ID, status: '0' }),
      }),
    );
  });

  it('findMany skips tenantId injection when IgnoreTenant flag is set', async () => {
    // IgnoreTenant 装饰器语义保留：当上下文标记忽略时不加 tenantId 过滤
    const { prisma, cls, findMany } = createMocks();
    await TenantContext.run({ tenantId: '100001', ignoreTenant: true }, async () => {
      const repo = new TestRepository(prisma, cls);
      await repo.findMany({ where: { status: '0' } });
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: '0' },
      }),
    );
  });

  it('count merges tenantId when in normal tenant context', async () => {
    const { prisma, cls, count } = createMocks();
    await TenantContext.run({ tenantId: '100001' }, async () => {
      const repo = new TestRepository(prisma, cls);
      await repo.count({ status: '0' });
    });
    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining({ tenantId: '100001', status: '0' }),
    });
  });
});

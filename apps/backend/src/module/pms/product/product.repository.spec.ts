import { DelFlag, PrismaClient, PublishStatus } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { ProductRepository } from './product.repository';

type ProductDelegate = {
  count: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  findUnique: jest.Mock;
};

function createMocks() {
  const findMany = jest.fn().mockResolvedValue([]);
  const findFirst = jest.fn().mockResolvedValue(null);
  const findUnique = jest.fn().mockResolvedValue(null);
  const count = jest.fn().mockResolvedValue(0);
  const prisma = {
    pmsProduct: {
      count,
      findFirst,
      findMany,
      findUnique,
    },
  } as unknown as PrismaService;
  const cls = {
    get: jest.fn().mockReturnValue(undefined),
  } as unknown as ClsService;

  return { cls, count, findFirst, findMany, findUnique, prisma };
}

describe('ProductRepository soft delete scope', () => {
  it('findWithRelations 在超级租户下也应过滤已软删除商品', async () => {
    const { prisma, cls, findMany } = createMocks();

    await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID }, async () => {
      const repo = new ProductRepository(prisma, cls);
      await repo.findWithRelations({ publishStatus: PublishStatus.ON_SHELF }, 0, 10);
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          delFlag: DelFlag.NORMAL,
          publishStatus: PublishStatus.ON_SHELF,
        }),
      }),
    );
  });

  it('findById 在超级租户下不应返回已软删除商品', async () => {
    const { prisma, cls, findFirst, findUnique } = createMocks();

    await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID }, async () => {
      const repo = new ProductRepository(prisma, cls);
      await repo.findById('prod-001');
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        productId: 'prod-001',
        delFlag: DelFlag.NORMAL,
      },
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('findOneWithDetails 在超级租户下不应返回已软删除商品', async () => {
    const { prisma, cls, findFirst, findUnique } = createMocks();

    await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID }, async () => {
      const repo = new ProductRepository(prisma, cls);
      await repo.findOneWithDetails('prod-001');
    });

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productId: 'prod-001',
          delFlag: DelFlag.NORMAL,
        },
      }),
    );
    expect(findUnique).not.toHaveBeenCalled();
  });
});

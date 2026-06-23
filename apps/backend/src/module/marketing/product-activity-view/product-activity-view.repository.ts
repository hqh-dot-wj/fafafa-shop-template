import { Injectable } from '@nestjs/common';
import { DelFlag, Prisma, PublishStatus } from '@prisma/client';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';

export const TENANT_PRODUCT_SELECT = {
  productId: true,
  isHot: true,
  sort: true,
  product: {
    select: {
      productId: true,
      categoryId: true,
      name: true,
      mainImages: true,
      publishStatus: true,
      delFlag: true,
    },
  },
} satisfies Prisma.PmsTenantProductSelect;

export type TenantProductRecord = Prisma.PmsTenantProductGetPayload<{
  select: typeof TENANT_PRODUCT_SELECT;
}>;

@Injectable()
export class ProductActivityViewRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  async listCategoryProducts(input: {
    tenantId: string;
    categoryId?: number | null;
    pageNum: number;
    pageSize: number;
  }) {
    const categoryId = input.categoryId;
    const where = this.tenantHelper.readWhereForDelegate('pmsTenantProduct', {
      tenantId: input.tenantId,
      status: PublishStatus.ON_SHELF,
      ...(Number.isFinite(categoryId) && (categoryId as number) > 0
        ? {
            product: {
              categoryId,
              publishStatus: PublishStatus.ON_SHELF,
              delFlag: DelFlag.NORMAL,
            },
          }
        : {}),
    }) as Prisma.PmsTenantProductWhereInput;

    const [rows, total] = await Promise.all([
      this.prisma.pmsTenantProduct.findMany({
        where,
        skip: (input.pageNum - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: [{ sort: 'asc' }, { createTime: 'desc' }],
        select: TENANT_PRODUCT_SELECT,
      }),
      this.prisma.pmsTenantProduct.count({ where }),
    ]);

    return { rows, total };
  }

  async listRecommendProducts(input: {
    tenantId: string;
    onlyHot?: boolean;
    pageNum: number;
    pageSize: number;
  }) {
    const where = this.tenantHelper.readWhereForDelegate('pmsTenantProduct', {
      tenantId: input.tenantId,
      status: PublishStatus.ON_SHELF,
      ...(input.onlyHot ? { isHot: true } : {}),
      product: {
        publishStatus: PublishStatus.ON_SHELF,
        delFlag: DelFlag.NORMAL,
      },
    }) as Prisma.PmsTenantProductWhereInput;

    const [rows, total] = await Promise.all([
      this.prisma.pmsTenantProduct.findMany({
        where,
        skip: (input.pageNum - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: [{ isHot: 'desc' }, { sort: 'asc' }, { createTime: 'desc' }],
        select: TENANT_PRODUCT_SELECT,
      }),
      this.prisma.pmsTenantProduct.count({ where }),
    ]);

    return { rows, total };
  }

  async findCategoryById(categoryId: number) {
    return this.prisma.pmsCategory.findUnique({
      where: { catId: categoryId },
      select: {
        catId: true,
        name: true,
      },
    });
  }
}

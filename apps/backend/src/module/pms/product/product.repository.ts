import { Injectable } from '@nestjs/common';
import { PmsProduct, Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { SoftDeleteRepository } from 'src/common/repository/base.repository';
import { PrismaService } from 'src/prisma/prisma.service';

type ProductWithListRelations = Prisma.PmsProductGetPayload<{
  include: {
    category: { select: { name: true; bindType: true } };
    brand: { select: { name: true } };
    globalSkus: {
      select: {
        skuId: true;
        guidePrice: true;
        costPrice: true;
        specValues: true;
        distMode: true;
        minDistRate: true;
        guideRate: true;
        maxDistRate: true;
      };
    };
  };
}>;

type ProductWithDetails = Prisma.PmsProductGetPayload<{
  include: {
    category: { select: { name: true; bindType: true; attrTemplateId: true } };
    brand: { select: { name: true } };
    globalSkus: true;
    attrValues: {
      include: {
        attribute: { select: { name: true; templateId: true } };
      };
    };
  };
}>;

/**
 * 商品仓储层
 * 封装商品相关的数据访问逻辑，继承BaseRepository提供通用CRUD操作
 * 提供带关联查询的复杂查询方法
 *
 * @class ProductRepository
 * @extends {BaseRepository<PmsProduct, Prisma.PmsProductCreateInput, Prisma.PmsProductUpdateInput>}
 */
@Injectable()
export class ProductRepository extends SoftDeleteRepository<
  PmsProduct,
  Prisma.PmsProductCreateInput,
  Prisma.PmsProductUpdateInput
> {
  /**
   * 构造函数
   * @param prisma - Prisma服务实例
   * @param cls - CLS上下文服务，用于事务管理
   */
  constructor(prisma: PrismaService, cls: ClsService) {
    super(prisma, cls, 'pmsProduct', 'productId');
  }

  /**
   * 获取自动租户过滤条件
   * 全局商品库是跨租户共享的
   */
  protected getTenantWhere(): Record<string, any> {
    return {};
  }

  async findById(
    id: number | string | bigint,
    options?: { include?: Record<string, boolean | object>; select?: Record<string, boolean> },
  ): Promise<PmsProduct | null> {
    const delegateWithFindFirst = this.delegate as {
      findFirst: (args: Prisma.PmsProductFindFirstArgs) => Promise<PmsProduct | null>;
    };

    return delegateWithFindFirst.findFirst({
      where: this.scopeReadWhere({ [this.getPrimaryKeyName()]: id }) as Prisma.PmsProductWhereInput,
      ...options,
    });
  }

  /**
   * 查询商品列表（带关联信息）
   * 关联查询分类名称、品牌名称和SKU信息
   * @param where - 查询条件
   * @param skip - 跳过记录数（分页）
   * @param take - 获取记录数（分页）
   * @returns 商品列表
   */
  async findWithRelations(
    where: Prisma.PmsProductWhereInput,
    skip: number,
    take: number,
  ): Promise<ProductWithListRelations[]> {
    return this.delegate.findMany({
      where: this.scopeReadWhere(where as object) as Prisma.PmsProductWhereInput,
      include: {
        category: { select: { name: true, bindType: true } },
        brand: { select: { name: true } },
        globalSkus: {
          select: {
            skuId: true,
            guidePrice: true,
            costPrice: true,
            specValues: true,
            distMode: true,
            minDistRate: true,
            guideRate: true,
            maxDistRate: true,
          },
        },
      },
      skip,
      take,
      orderBy: { createTime: 'desc' },
    });
  }

  /**
   * 统计商品数量（带查询条件）
   * @param where - 查询条件
   * @returns 商品数量
   */
  async countWithConditions(where: Prisma.PmsProductWhereInput): Promise<number> {
    return this.count(where);
  }

  /**
   * 查询商品详情（带完整关联信息）
   * 关联查询分类、品牌、SKU列表和属性值列表
   * @param productId - 商品ID
   * @returns 商品详情对象或null
   */
  async findOneWithDetails(productId: string): Promise<ProductWithDetails | null> {
    const delegateWithFindFirst = this.delegate as {
      findFirst: (args: Prisma.PmsProductFindFirstArgs) => Promise<ProductWithDetails | null>;
    };

    return delegateWithFindFirst.findFirst({
      where: this.scopeReadWhere({ productId }) as Prisma.PmsProductWhereInput,
      include: {
        category: { select: { name: true, bindType: true, attrTemplateId: true } },
        brand: { select: { name: true } },
        globalSkus: true,
        attrValues: {
          include: {
            attribute: { select: { name: true, templateId: true } },
          },
        },
      },
    });
  }
}

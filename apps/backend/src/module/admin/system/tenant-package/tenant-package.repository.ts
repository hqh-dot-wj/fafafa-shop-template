import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Prisma, SysTenantPackage } from '@prisma/client';
import { SoftDeleteRepository } from 'src/common/repository/base.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { DelFlagEnum, StatusEnum } from 'src/common/enum/index';

/**
 * 租户套餐仓储层
 *
 * @description 封装租户套餐的数据访问逻辑
 */
@Injectable()
export class TenantPackageRepository extends SoftDeleteRepository<
  SysTenantPackage,
  Prisma.SysTenantPackageCreateInput,
  Prisma.SysTenantPackageUpdateInput,
  Prisma.SysTenantPackageDelegate
> {
  constructor(prisma: PrismaService, cls: ClsService) {
    super(prisma, cls, 'sysTenantPackage', 'packageId');
  }

  /** 套餐主数据无 tenantId，不参与租户合并 */
  protected getTenantWhere(): Record<string, unknown> {
    return {};
  }

  /**
   * 分页查询租户套餐列表
   */
  async findPageWithFilter(
    where: Prisma.SysTenantPackageWhereInput,
    skip: number,
    take: number,
    orderBy?: Prisma.SysTenantPackageOrderByWithRelationInput,
  ): Promise<{ list: SysTenantPackage[]; total: number }> {
    const scopedWhere = this.scopeReadWhere(where as object) as Prisma.SysTenantPackageWhereInput;
    const [list, total] = await this.prisma.$transaction([
      this.delegate.findMany({
        where: scopedWhere,
        skip,
        take,
        orderBy: orderBy || { createTime: 'desc' },
      }),
      this.delegate.count({ where: scopedWhere }),
    ]);

    return { list, total };
  }

  /**
   * 根据套餐名称查询（不包括已删除的）
   */
  async findByPackageName(packageName: string, excludeId?: number): Promise<SysTenantPackage | null> {
    const where: Prisma.SysTenantPackageWhereInput = {
      packageName,
      delFlag: DelFlagEnum.NORMAL,
    };

    if (excludeId) {
      where.packageId = { not: excludeId };
    }

    return this.delegate.findFirst({
      where: this.scopeReadWhere(where as object) as Prisma.SysTenantPackageWhereInput,
    });
  }

  /**
   * 检查套餐是否被租户使用
   */
  async isPackageInUse(packageId: number): Promise<boolean> {
    const count = await this.prisma.sysTenant.count({
      where: {
        packageId,
        delFlag: DelFlagEnum.NORMAL,
      },
    });

    return count > 0;
  }

  /**
   * 获取所有正常状态的套餐列表
   */
  async findAllNormalPackages(): Promise<SysTenantPackage[]> {
    return this.delegate.findMany({
      where: this.scopeReadWhere({
        status: StatusEnum.NORMAL,
        delFlag: DelFlagEnum.NORMAL,
      }) as Prisma.SysTenantPackageWhereInput,
      orderBy: { createTime: 'desc' },
    });
  }

  /**
   * 根据套餐ID查询关联的菜单ID列表
   */
  async findMenuIdsByPackageId(packageId: number): Promise<number[]> {
    const packageData = await this.delegate.findUnique({
      where: { packageId },
      select: { menuIds: true },
    });

    if (!packageData?.menuIds) {
      return [];
    }

    // menuIds 是逗号分隔的字符串，需要转换为数字数组
    return packageData.menuIds
      .split(',')
      .filter(Boolean)
      .map((id) => parseInt(id, 10));
  }
}

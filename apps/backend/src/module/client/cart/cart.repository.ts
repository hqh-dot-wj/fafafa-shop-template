import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseRepository } from 'src/common/repository/base.repository';
import { OmsCartItem, Prisma } from '@prisma/client';

import { ClsService } from 'nestjs-cls';

@Injectable()
export class CartRepository extends BaseRepository<OmsCartItem, Prisma.OmsCartItemCreateInput> {
  constructor(
    prisma: PrismaService,
    private readonly clsService: ClsService,
  ) {
    super(prisma, clsService, 'omsCartItem');
  }

  /**
   * 批量删除购物车商品 (硬删除)
   */
  async deleteByMemberAndTenant(memberId: string, tenantId: string, skuIds: string[]) {
    return this.client.omsCartItem.deleteMany({
      where: {
        memberId,
        tenantId,
        skuId: { in: skuIds },
      },
    });
  }

  async deleteCheckedOutLines(
    memberId: string,
    tenantId: string,
    lines: Array<{ skuId: string; activityContextKey: string | null }>,
  ) {
    if (lines.length === 0) {
      return { count: 0 };
    }
    const results = await Promise.all(
      lines.map((line) =>
        this.client.omsCartItem.deleteMany({
          where: {
            memberId,
            tenantId,
            skuId: line.skuId,
            activityContextKey: line.activityContextKey,
          },
        }),
      ),
    );
    return { count: results.reduce((sum, item) => sum + item.count, 0) };
  }

  /**
   * 清空购物车 (硬删除)
   */
  async clearCart(memberId: string, tenantId: string) {
    return this.client.omsCartItem.deleteMany({
      where: { memberId, tenantId },
    });
  }

  /**
   * 查询购物车列表
   */
  async findList(memberId: string, tenantId: string): Promise<OmsCartItem[]> {
    return this.findMany({
      where: { memberId, tenantId },
      orderBy: { updateTime: 'desc' },
    });
  }
}

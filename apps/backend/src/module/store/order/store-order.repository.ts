import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseRepository } from 'src/common/repository';
import { OmsOrder, Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { TenantContext } from 'src/common/tenant/tenant.context';

@Injectable()
export class StoreOrderRepository extends BaseRepository<
  OmsOrder,
  Prisma.OmsOrderCreateInput,
  Prisma.OmsOrderUpdateInput
> {
  constructor(prisma: PrismaService, cls: ClsService) {
    super(prisma, cls, 'omsOrder');
  }

  /**
   * 聚合查询订单数据
   */
  async aggregate(
    args: Prisma.OmsOrderAggregateArgs,
  ): Promise<Prisma.GetOmsOrderAggregateType<Prisma.OmsOrderAggregateArgs>> {
    const where = this.scopeReadWhere((args.where ?? {}) as object) as Prisma.OmsOrderWhereInput;
    const result = await this.prisma.omsOrder.aggregate({ ...args, where });
    return result as Prisma.GetOmsOrderAggregateType<Prisma.OmsOrderAggregateArgs>;
  }

  /**
   * 已支付订单按日汇总实付金额（看板趋势，近若干自然日）
   *
   * @param since - 起始日 00:00:00（含）
   */
  async sumPaidAmountByDaySince(since: Date): Promise<Array<{ day: string; amount: number }>> {
    const allTenants = TenantContext.isSuperTenant();
    const tenantId = TenantContext.getTenantId();
    const tenantFilter =
      allTenants || !tenantId ? Prisma.empty : Prisma.sql`AND o.tenant_id = ${tenantId}`;

    const rows = await this.prisma.$queryRaw<Array<{ day: string; amount: number }>>`
      SELECT to_char(date_trunc('day', o.create_time), 'YYYY-MM-DD') AS day
           , COALESCE(SUM(o.pay_amount), 0)::float AS amount
      FROM oms_order o
      WHERE o.pay_status = '1'::"PayStatus"
        AND o.del_flag = '0'::"DelFlag"
        AND o.create_time >= ${since}
        ${tenantFilter}
      GROUP BY date_trunc('day', o.create_time)
      ORDER BY day ASC
    `;

    return rows;
  }
}

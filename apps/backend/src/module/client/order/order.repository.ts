import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SoftDeleteRepository } from 'src/common/repository/soft-delete.repository';
import { OmsOrder, OrderStatus, PayStatus, Prisma } from '@prisma/client';
import { DelFlagEnum } from 'src/common/enum/index';

import { ClsService } from 'nestjs-cls';
import { TenantHelper } from 'src/common/tenant/tenant.helper';

@Injectable()
export class OrderRepository extends SoftDeleteRepository<OmsOrder, Prisma.OmsOrderCreateInput> {
  constructor(
    prisma: PrismaService,
    clsService: ClsService,
    private readonly tenantHelper: TenantHelper,
  ) {
    super(prisma, clsService, 'omsOrder', 'id');
  }

  /**
   * 软删：以 delFlag 为准，并写入 deleteTime 供审计
   */
  async softDelete(id: string): Promise<OmsOrder> {
    return this.update(id, {
      delFlag: DelFlagEnum.DELETE,
      deleteTime: new Date(),
    });
  }

  override async softDeleteBatch(ids: (number | string | bigint)[]): Promise<number> {
    const result = await this.updateMany(
      { id: { in: ids as string[] } },
      { delFlag: DelFlagEnum.DELETE, deleteTime: new Date() },
    );
    return result.count;
  }

  /**
   * 根据订单号查询
   */
  async findBySn(orderSn: string) {
    return this.client.omsOrder.findFirst({
      where: this.tenantHelper.readWhereForDelegate('omsOrder', { orderSn }) as Prisma.OmsOrderWhereInput,
    });
  }

  /**
   * 更新订单状态
   */
  async updateStatus(orderId: string, status: OrderStatus, remark?: string) {
    return this.client.omsOrder.update({
      where: { id: orderId },
      data: {
        status,
        remark: remark ? remark : undefined,
      },
    });
  }

  /**
   * 条件更新订单状态（CAS）
   * 仅当当前状态匹配时才更新，避免并发状态覆盖
   */
  async updateStatusIfCurrent(orderId: string, currentStatus: OrderStatus, nextStatus: OrderStatus, remark?: string) {
    return this.client.omsOrder.updateMany({
      where: {
        id: orderId,
        status: currentStatus,
      },
      data: {
        status: nextStatus,
        remark: remark ? remark : undefined,
      },
    });
  }

  /**
   * 取消未支付订单的条件更新（CAS）
   * 仅待支付且支付状态仍为未支付时才允许关闭，避免支付回调与自动取消互相覆盖。
   */
  async cancelUnpaidIfCurrent(orderId: string, remark?: string) {
    return this.client.omsOrder.updateMany({
      where: {
        id: orderId,
        status: OrderStatus.PENDING_PAY,
        payStatus: PayStatus.UNPAID,
        delFlag: DelFlagEnum.NORMAL,
      },
      data: {
        status: OrderStatus.CANCELLED,
        remark: remark ? remark : undefined,
      },
    });
  }

  /**
   * 查询超时未支付订单，供代码托管任务兜底扫描。
   */
  async findTimedOutUnpaidOrders(deadline: Date, take: number) {
    return this.client.omsOrder.findMany({
      where: {
        status: OrderStatus.PENDING_PAY,
        payStatus: PayStatus.UNPAID,
        createTime: { lt: deadline },
        delFlag: DelFlagEnum.NORMAL,
      },
      select: {
        id: true,
        orderSn: true,
        tenantId: true,
        memberId: true,
        createTime: true,
      },
      orderBy: { createTime: 'asc' },
      take,
    });
  }
}

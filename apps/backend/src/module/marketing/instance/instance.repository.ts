import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseRepository } from 'src/common/repository/base.repository';
import { PlayInstance, Prisma, PlayInstanceStatus } from '@prisma/client';
import { CreatePlayInstanceDto, ListPlayInstanceDto, UpdatePlayInstanceDto } from './dto/instance.dto';
import { ClsService } from 'nestjs-cls';

/**
 * 营销实例仓储
 *
 * @description 处理营销活动执行实例的持久化操作
 */
@Injectable()
export class PlayInstanceRepository extends BaseRepository<PlayInstance, CreatePlayInstanceDto, UpdatePlayInstanceDto> {
  constructor(prisma: PrismaService, cls: ClsService) {
    super(prisma, cls, 'playInstance');
  }

  /**
   * 分页搜索实例
   */
  async search(query: ListPlayInstanceDto) {
    const where: Prisma.PlayInstanceWhereInput = {};

    if (query.tenantId) {
      where.tenantId = query.tenantId;
    }

    if (query.memberId) {
      where.memberId = query.memberId;
    }

    if (query.status) {
      where.status = query.status;
    }

    return this.findPage({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      where,
      orderBy: 'createTime',
      order: 'desc',
    });
  }

  /**
   * 按订单号查询实例
   */
  async findByOrderSn(orderSn: string) {
    return this.findOne({ orderSn });
  }

  /**
   * 按系统订单ID查询实例
   *
   * @param orderId 系统订单ID（OmsOrder.id）
   * @returns 匹配的实例，不存在返回 null
   */
  async findByOrderId(orderId: string) {
    return this.findOne({ orderId });
  }

  /**
   * 查询探针所需的实例基础信息
   */
  async findProbeBase(tenantId: string, id: string) {
    return this.delegate.findFirst({
      where: this.scopeReadWhere({ tenantId, id }) as Prisma.PlayInstanceWhereInput,
      select: {
        id: true,
        tenantId: true,
        memberId: true,
        configId: true,
        templateCode: true,
        orderSn: true,
        orderId: true,
        status: true,
        createTime: true,
        payTime: true,
        endTime: true,
        updateTime: true,
        instanceData: true,
      },
    });
  }

  /**
   * 更新实例状态
   */
  async updateStatus(id: string, status: PlayInstanceStatus, instanceData?: Record<string, unknown>) {
    const data: Prisma.PlayInstanceUpdateInput = { status };
    if (instanceData) {
      data.instanceData = instanceData as Prisma.InputJsonValue;
    }

    // 如果是终态，记录结束时间
    const finalStatuses: PlayInstanceStatus[] = [
      PlayInstanceStatus.SUCCESS,
      PlayInstanceStatus.FAILED,
      PlayInstanceStatus.REFUNDED,
      PlayInstanceStatus.TIMEOUT,
    ];
    if (finalStatuses.includes(status)) {
      data.endTime = new Date();
    }

    // 如果是支付成功，记录支付时间
    if (status === PlayInstanceStatus.PAID) {
      data.payTime = new Date();
    }

    return this.update(id, data);
  }

  /**
   * 绑定实例到系统订单（设置标量 orderId 字段）
   *
   * @param id - 实例ID
   * @param orderId - OmsOrder.id
   */
  async updateOrderBinding(id: string, orderId: string) {
    return (this.delegate as Prisma.PlayInstanceDelegate).update({
      where: { id },
      data: { order: { connect: { id: orderId } } },
    });
  }

  /**
   * 批量更新实例状态
   */
  async batchUpdateStatus(ids: string[], status: PlayInstanceStatus, instanceData?: Record<string, unknown>) {
    const data: Prisma.PlayInstanceUpdateManyMutationInput = { status };
    if (instanceData) {
      data.instanceData = instanceData as Prisma.InputJsonValue;
    }

    const finalStatuses: PlayInstanceStatus[] = [
      PlayInstanceStatus.SUCCESS,
      PlayInstanceStatus.FAILED,
      PlayInstanceStatus.REFUNDED,
      PlayInstanceStatus.TIMEOUT,
    ];
    if (finalStatuses.includes(status)) {
      data.endTime = new Date();
    }

    if (status === PlayInstanceStatus.PAID) {
      data.payTime = new Date();
    }

    return this.prisma.playInstance.updateMany({
      where: { id: { in: ids } },
      data,
    });
  }
}

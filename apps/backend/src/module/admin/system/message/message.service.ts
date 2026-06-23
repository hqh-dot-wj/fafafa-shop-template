import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Result } from 'src/common/response';
import { ListMessageDto, CreateMessageDto } from './dto/message.dto';
import { FormatDateFields } from 'src/common/utils';
import { Prisma } from '@prisma/client';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { NotificationService } from 'src/module/notification/notification.service';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * 创建消息
   *
   * `receiverId` 是兼容字段名，但语义已经收敛为“站内信目标”：
   * - 纯数字字符串 => 后台用户个人收件箱
   * - 与 tenantId 相同 => 当前租户广播收件箱
   *
   * 统一走 NotificationService，避免管理端直写 sys_message 绕过 SSE/通知审计。
   */
  async create(dto: CreateMessageDto) {
    const target = this.normalizeInAppTarget(dto.receiverId, dto.tenantId);

    await this.notificationService.send({
      target,
      channel: 'IN_APP',
      title: dto.title,
      content: dto.content ?? '',
      tenantId: dto.tenantId,
      template: dto.type,
    });

    return Result.ok({
      title: dto.title,
      content: dto.content ?? '',
      type: dto.type,
      receiverId: target,
      tenantId: dto.tenantId,
    });
  }

  /**
   * 发送新订单通知
   *
   * 旧实现把 `tenantId` 同时当作站内信接收目标和短信目标，会让通知模型与手机号模型混杂。
   * 这里统一收敛到 NotificationService，由通知模块负责落库、SSE 和后续渠道扩展。
   *
   * @param order 订单信息，至少包含 orderSn、payAmount、tenantId
   */
  async notifyNewOrder(order: { orderSn: string; payAmount: number | string; tenantId: string }) {
    const title = '您有新订单';
    const content = `订单号: ${order.orderSn}, 金额: ${order.payAmount}`;

    await this.notificationService.send({
      target: order.tenantId,
      channel: 'IN_APP',
      title,
      content,
      tenantId: order.tenantId,
    });

    this.logger.warn(
      `notifyNewOrder 已收敛为站内信链路；若需短信通知，请先建立租户管理员手机号解析模型 tenantId=${order.tenantId}`,
    );
  }

  /**
   * 查询消息列表
   */
  async findAll(query: ListMessageDto, currentTenantId: string, adminUserId?: number) {
    const base: Prisma.SysMessageWhereInput = {
      tenantId: currentTenantId,
    };

    if (query.type) {
      base.type = query.type;
    }

    if (query.isRead !== undefined) {
      base.isRead = query.isRead;
    }

    if (query.adminInbox === true && adminUserId !== undefined) {
      base.OR = this.buildAdminInboxTargets(currentTenantId, adminUserId);
    }

    const where = this.tenantHelper.readWhereForDelegate('sysMessage', base as object) as Prisma.SysMessageWhereInput;

    const [list, total] = await this.prisma.$transaction([
      this.prisma.sysMessage.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createTime: 'desc' },
      }),
      this.prisma.sysMessage.count({
        where: this.tenantHelper.readWhereForDelegate('sysMessage', base as object) as Prisma.SysMessageWhereInput,
      }),
    ]);

    return Result.page(FormatDateFields(list), total);
  }

  /**
   * 标记已读
   */
  async read(id: number) {
    await this.prisma.sysMessage.update({
      where: { id },
      data: { isRead: true },
    });
    return Result.ok();
  }

  /**
   * 删除消息
   */
  async delete(id: number) {
    await this.prisma.sysMessage.delete({
      where: { id },
    });
    return Result.ok();
  }

  private buildAdminInboxTargets(currentTenantId: string, adminUserId: number): Prisma.SysMessageWhereInput[] {
    return [{ receiverId: String(adminUserId) }, { receiverId: currentTenantId }];
  }

  private normalizeInAppTarget(receiverId: string, tenantId: string): string {
    const normalizedReceiverId = receiverId.trim();
    const normalizedTenantId = tenantId.trim();

    if (!normalizedReceiverId) {
      throw new Error('receiverId 不能为空');
    }

    if (normalizedReceiverId === normalizedTenantId) {
      return normalizedTenantId;
    }

    if (!/^\d+$/.test(normalizedReceiverId)) {
      this.logger.warn(
        `收到非数字且非租户广播的 receiverId=${normalizedReceiverId}，当前仅支持后台 userId 或 tenantId 广播，按原值透传以兼容历史数据`,
      );
    }

    return normalizedReceiverId;
  }
}

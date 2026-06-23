import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationChannel, NotificationMessage } from './interfaces/notification.types';
import { NotificationDispatchContext } from './interfaces/notification-dispatch-context.types';
import { NotificationPolicySnapshot } from './interfaces/notification-policy.types';
import { NotificationPolicyService } from './policy/notification-policy.service';

export const NOTIFICATION_QUEUE = 'NOTIFICATION';

export interface SendNotificationParams {
  /**
   * 接收目标。`IN_APP` 时写入 `sys_message.receiver_id`，并触发管理端 SSE：
   * - 纯数字字符串：推送给对应后台用户 `userId` 的连接；
   * - 与 `tenantId` 相同：推送给该租户下所有已连接管理端（如租户级库存预警）。
   */
  target: string;
  channel: NotificationChannel;
  template?: string;
  templateVersion?: string;
  title?: string;
  content: string;
  params?: Record<string, string>;
  tenantId: string;
  dispatchContext?: Partial<NotificationDispatchContext>;
}

interface NotificationJob {
  logId: number;
  channel: NotificationChannel;
  target: string;
  message: NotificationMessage;
  dispatchContext?: NotificationDispatchContext;
  policySnapshot?: NotificationPolicySnapshot;
}

/**
 * 通知服务
 * 推入 BullMQ 队列，失败重试最多 3 次、间隔指数递增（AC-10）
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectQueue(NOTIFICATION_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly policyService: NotificationPolicyService,
  ) {}

  /**
   * 发送通知（异步）
   */
  async send(params: SendNotificationParams): Promise<void> {
    const dispatchContext = this.buildDispatchContext(params);
    const policyDecision = dispatchContext ? this.policyService.evaluate(dispatchContext) : null;

    const log = await this.prisma.sysNotificationLog.create({
      data: {
        tenantId: params.tenantId,
        channel: params.channel,
        target: params.target,
        template: params.template ?? null,
        title: params.title ?? null,
        content: params.content,
        status: policyDecision?.allowed === false ? 'FAILED' : 'QUEUED',
        errorMsg: policyDecision?.allowed === false ? (policyDecision.message ?? policyDecision.reason ?? 'POLICY_REJECTED') : null,
        bizType: dispatchContext?.bizType ?? null,
        bizRefId: dispatchContext?.bizRefId ?? null,
        activityId: dispatchContext?.activityId ?? null,
        touchpointCode: dispatchContext?.touchpointCode ?? null,
        touchpointKind: dispatchContext?.touchpointKind ?? null,
        sceneCode: dispatchContext?.sceneCode ?? null,
        policySnapshot: (policyDecision?.snapshot ?? null) as unknown as Prisma.InputJsonValue | null,
      },
    });

    if (policyDecision && !policyDecision.allowed) {
      this.logger.warn(
        `Notification blocked by policy: logId=${log.id}, reason=${policyDecision.reason ?? 'UNKNOWN'}, channel=${params.channel}`,
      );
      return;
    }

    await this.queue.add(
      {
        logId: log.id,
        channel: params.channel,
        target: params.target,
        message: {
          title: params.title,
          content: params.content,
          template: params.template,
          templateVersion: params.templateVersion ?? dispatchContext?.templateVersion,
          params: params.params,
          tenantId: params.tenantId,
        },
        dispatchContext,
        policySnapshot: policyDecision?.snapshot,
      } as NotificationJob,
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );

    this.logger.log(`Notification queued: logId=${log.id}, channel=${params.channel}, target=${params.target}`);
  }

  /**
   * 多渠道发送
   */
  async sendMulti(
    target: string,
    channels: NotificationChannel[],
    params: Omit<SendNotificationParams, 'target' | 'channel'>,
  ): Promise<void> {
    for (const channel of channels) {
      await this.send({ ...params, target, channel });
    }
  }

  private buildDispatchContext(params: SendNotificationParams): NotificationDispatchContext | null {
    if (!params.dispatchContext) {
      return null;
    }

    const context = params.dispatchContext;
    const requestedAt = context.requestedAt ? new Date(context.requestedAt) : new Date();

    return {
      tenantId: context.tenantId ?? params.tenantId,
      bizType: context.bizType ?? 'MARKETING_ACTIVITY',
      bizRefId: context.bizRefId ?? context.activityId ?? params.target,
      activityId: context.activityId,
      touchpointCode: context.touchpointCode,
      touchpointKind: context.touchpointKind,
      sceneCode: context.sceneCode,
      channel: context.channel ?? params.channel,
      templateCode: context.templateCode ?? params.template,
      templateVersion: context.templateVersion ?? params.templateVersion,
      consentGranted: context.consentGranted,
      requestedAt,
      quietHours: context.quietHours,
      frequency: context.frequency,
      suppression: context.suppression,
    };
  }
}

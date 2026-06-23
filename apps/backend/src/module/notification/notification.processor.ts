import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NOTIFICATION_QUEUE } from './notification.service';
import { InAppChannel } from './channels/in-app.channel';
import { SmsChannel } from './channels/sms.channel';
import { WechatTemplateChannel } from './channels/wechat-template.channel';
import { AppPushChannel } from './channels/app-push.channel';
import { NotificationChannel } from './interfaces/notification.types';
import { getErrorMessage } from 'src/common/utils/error';
import { SseService } from 'src/module/admin/resource/sse.service';
import { IN_APP_SSE_KIND, type InAppSsePayloadV1 } from './interfaces/in-app-sse-payload';
import { NotificationDispatchContext } from './interfaces/notification-dispatch-context.types';
import { NotificationPolicySnapshot } from './interfaces/notification-policy.types';

interface NotificationJob {
  logId: number;
  channel: NotificationChannel;
  target: string;
  message: {
    title?: string;
    content: string;
    template?: string;
    templateVersion?: string;
    params?: Record<string, string>;
    tenantId: string;
  };
  dispatchContext?: NotificationDispatchContext;
  policySnapshot?: NotificationPolicySnapshot;
}

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inAppChannel: InAppChannel,
    private readonly smsChannel: SmsChannel,
    private readonly wechatTemplateChannel: WechatTemplateChannel,
    private readonly appPushChannel: AppPushChannel,
    private readonly sseService: SseService,
  ) {}

  @Process()
  async handleNotification(job: Job<NotificationJob>) {
    const { logId, channel, target, message } = job.data;

    await this.prisma.sysNotificationLog.update({
      where: { id: logId },
      data: { status: 'SENDING' },
    });

    const channelImpl = this.getChannel(channel);
    try {
      const result = await channelImpl.send(target, message);

      if (result.success) {
        await this.prisma.sysNotificationLog.update({
          where: { id: logId },
          data: {
            status: 'SENT',
            providerMessageId: result.providerMessageId ?? null,
          },
        });
        if (channel === 'IN_APP' && typeof result.messageId === 'number') {
          const payload: InAppSsePayloadV1 = {
            v: 1,
            kind: IN_APP_SSE_KIND,
            messageId: result.messageId,
            title: message.title,
            content: message.content,
            type: message.template ?? 'SYSTEM',
            tenantId: message.tenantId,
          };
          this.sseService.pushInAppNotification({
            target,
            tenantId: message.tenantId,
            payload: JSON.stringify(payload),
          });
        }
      } else {
        throw new Error(result.error ?? 'Send failed');
      }
    } catch (error) {
      const errMsg = getErrorMessage(error);
      await this.prisma.sysNotificationLog.update({
        where: { id: logId },
        data: { status: 'FAILED', errorMsg: errMsg },
      });
      this.logger.error(`Notification failed: logId=${logId}, channel=${channel}`, errMsg);
      throw error;
    }
  }

  private getChannel(channel: NotificationChannel) {
    const map = {
      IN_APP: this.inAppChannel,
      SMS: this.smsChannel,
      WECHAT_TEMPLATE: this.wechatTemplateChannel,
      APP_PUSH: this.appPushChannel,
    } as const;
    const impl = map[channel];
    if (!impl) throw new Error(`Unknown notification channel: ${channel}`);
    return impl;
  }
}

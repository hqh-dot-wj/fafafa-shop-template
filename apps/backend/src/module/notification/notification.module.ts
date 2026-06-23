import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NotificationService, NOTIFICATION_QUEUE } from './notification.service';
import { NotificationProcessor } from './notification.processor';
import { NotificationController } from './notification.controller';
import { InAppChannel } from './channels/in-app.channel';
import { SmsOutboundModule } from './channels/sms-outbound.module';
import { WechatTemplateChannel } from './channels/wechat-template.channel';
import { AppPushChannel } from './channels/app-push.channel';
import { StubSmsProvider } from './channels/providers/stub-sms.provider';
import { AliyunSmsProvider } from './channels/providers/aliyun-sms.provider';
import { ResourceModule } from 'src/module/admin/resource/resource.module';
import { NotificationPolicyService } from './policy/notification-policy.service';

@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATION_QUEUE }), SmsOutboundModule, ResourceModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationProcessor,
    NotificationPolicyService,
    InAppChannel,
    WechatTemplateChannel,
    AppPushChannel,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}

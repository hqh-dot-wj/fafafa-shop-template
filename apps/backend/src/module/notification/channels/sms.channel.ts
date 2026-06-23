import { Injectable } from '@nestjs/common';
import { NotificationMessage, SendResult } from '../interfaces/notification.types';
import { SmsOutboundFacade } from './sms-outbound.facade';

/**
 * 短信通知渠道：委托 SmsOutboundFacade 选择 Stub / 阿里云
 */
@Injectable()
export class SmsChannel {
  constructor(private readonly smsOutbound: SmsOutboundFacade) {}

  async send(target: string, message: NotificationMessage): Promise<SendResult> {
    return this.smsOutbound.sendNotificationSms(target, message);
  }
}

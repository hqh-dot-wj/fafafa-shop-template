import { Module } from '@nestjs/common';
import { AliyunSmsProvider } from './providers/aliyun-sms.provider';
import { StubSmsProvider } from './providers/stub-sms.provider';
import { SmsChannel } from './sms.channel';
import { SmsOutboundFacade } from './sms-outbound.facade';

@Module({
  providers: [StubSmsProvider, AliyunSmsProvider, SmsOutboundFacade, SmsChannel],
  exports: [SmsOutboundFacade, SmsChannel],
})
export class SmsOutboundModule {}

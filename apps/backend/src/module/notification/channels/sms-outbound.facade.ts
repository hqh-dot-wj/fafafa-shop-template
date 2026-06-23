import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from 'src/config/app-config.service';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response/response.interface';
import type { NotificationMessage, SendResult } from '../interfaces/notification.types';
import { AliyunSmsProvider } from './providers/aliyun-sms.provider';
import { StubSmsProvider } from './providers/stub-sms.provider';
import type { VerificationSmsPayload } from './providers/verification-sms.types';

/**
 * 短信外发门面：按环境选择 Stub / 阿里云；生产未配置阿里云时拒绝认证短信、通知短信返回失败结果
 */
@Injectable()
export class SmsOutboundFacade {
  private readonly logger = new Logger(SmsOutboundFacade.name);

  constructor(
    private readonly stub: StubSmsProvider,
    private readonly aliyun: AliyunSmsProvider,
    private readonly appConfig: AppConfigService,
  ) {}

  /**
   * 登录/重置等认证场景：失败时抛业务异常（调用方可统一返回友好文案）
   */
  async sendVerificationSms(payload: VerificationSmsPayload): Promise<void> {
    if (this.aliyun.isReady()) {
      await this.aliyun.sendVerificationCode(payload);
      return;
    }
    BusinessException.throwIf(this.appConfig.isProduction, '短信服务未配置', ResponseCode.SERVICE_UNAVAILABLE);
    await this.stub.sendVerificationCode(payload);
  }

  /**
   * 通知队列异步短信：生产未配置时不抛异常，避免拖死队列重试，由上层标记 FAILED
   */
  async sendNotificationSms(target: string, message: NotificationMessage): Promise<SendResult> {
    if (this.aliyun.isReady()) {
      try {
        await this.aliyun.sendPlainText({
          phone: target,
          text: message.content,
          tenantId: message.tenantId,
        });
        return { success: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : '短信发送失败';
        this.logger.error(`[SMS] 阿里云通知短信失败: ${msg}`);
        return { success: false, error: msg };
      }
    }

    if (this.appConfig.isProduction) {
      this.logger.error(`[SMS] 生产环境未配置阿里云短信，拒绝通知发送: ${target}`);
      return { success: false, error: '短信服务未配置' };
    }

    await this.stub.sendPlainText({
      phone: target,
      text: message.content,
      tenantId: message.tenantId,
    });
    return { success: true };
  }
}

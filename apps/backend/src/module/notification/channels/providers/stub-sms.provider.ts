import { Injectable, Logger } from '@nestjs/common';
import type { PlainSmsPayload, VerificationSmsPayload } from './verification-sms.types';

/**
 * 开发/测试环境短信桩：记录日志，不调用外网
 */
@Injectable()
export class StubSmsProvider {
  private readonly logger = new Logger(StubSmsProvider.name);

  private maskPhone(phone: string): string {
    if (phone.length < 7) return '***';
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
  }

  async sendVerificationCode(payload: VerificationSmsPayload): Promise<void> {
    const min = payload.validMinutes ?? 5;
    this.logger.log(
      `[SMS Stub][验证码] tenant=${payload.tenantId} scene=${payload.scene} phone=${this.maskPhone(payload.phone)} ttlMin=${min}`,
    );
  }

  async sendPlainText(payload: PlainSmsPayload): Promise<void> {
    this.logger.log(
      `[SMS Stub][通知] tenant=${payload.tenantId} phone=${this.maskPhone(payload.phone)} bodyLength=${payload.text.length}`,
    );
  }
}

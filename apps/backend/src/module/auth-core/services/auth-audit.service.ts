import { Injectable, Logger } from '@nestjs/common';

export enum AuthAuditEvent {
  SMS_CODE_SENT = 'auth.sms_code.sent',
  SMS_CODE_VERIFY_FAIL = 'auth.sms_code.verify_fail',
  PASSWORD_RESET_PREPARED = 'auth.password_reset.prepared',
}

/**
 * 认证审计：当前以结构化日志输出，后续可对接审计表或消息队列
 */
@Injectable()
export class AuthAuditService {
  private readonly logger = new Logger(AuthAuditService.name);

  log(event: AuthAuditEvent, meta: Record<string, string>): void {
    this.logger.log(JSON.stringify({ event, ...meta }));
  }
}

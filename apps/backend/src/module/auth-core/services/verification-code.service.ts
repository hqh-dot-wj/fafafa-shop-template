import { Injectable } from '@nestjs/common';
import { CacheEnum } from 'src/common/enum/cache.enum';
import { SmsVerificationScene } from '../constants/sms-verification-scene.enum';

/**
 * 验证码相关 Redis Key 与场景约定（图形验证码仍由 MainController 写入，此处仅统一命名空间）
 */
@Injectable()
export class VerificationCodeService {
  /** 短信验证码存储 Key */
  smsCodeKey(tenantId: string, scene: SmsVerificationScene, phone: string): string {
    return `auth:sms:code:${tenantId}:${scene}:${phone}`;
  }

  /** 两次发送最小间隔锁 Key */
  smsSendGapKey(tenantId: string, scene: SmsVerificationScene, phone: string): string {
    return `auth:sms:gap:${tenantId}:${scene}:${phone}`;
  }

  /** 滑动窗口内发送次数计数 Key */
  smsSendHourlyCountKey(tenantId: string, scene: SmsVerificationScene, phone: string): string {
    return `auth:sms:cnt:hour:${tenantId}:${scene}:${phone}`;
  }

  /** 与系统图形验证码 Key 前缀对齐，供后续接入统一校验时复用 */
  captchaRedisKey(uuid: string): string {
    return `${CacheEnum.CAPTCHA_CODE_KEY}${uuid}`;
  }
}

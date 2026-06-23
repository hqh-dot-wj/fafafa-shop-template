import { Injectable, Logger } from '@nestjs/common';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response/response.interface';
import { RedisService } from 'src/module/common/redis/redis.service';
import { SmsOutboundFacade } from 'src/module/notification/channels/sms-outbound.facade';
import { SmsVerificationScene } from '../constants/sms-verification-scene.enum';
import { VerificationCodeService } from './verification-code.service';

const SMS_CODE_TTL_MS = 5 * 60 * 1000;
const SEND_MIN_INTERVAL_MS = 60 * 1000;
const SEND_HOURLY_MAX = 10;
const HOURLY_WINDOW_MS = 60 * 60 * 1000;

@Injectable()
export class SmsCodeService {
  private readonly logger = new Logger(SmsCodeService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly keys: VerificationCodeService,
    private readonly smsOutbound: SmsOutboundFacade,
  ) {}

  private generateSixDigitCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  /**
   * 生成并发送短信验证码（写入 Redis + 限流 + 外发）
   */
  async sendCode(phone: string, scene: SmsVerificationScene, tenantId: string): Promise<void> {
    const cntKey = this.keys.smsSendHourlyCountKey(tenantId, scene, phone);
    const count = await this.redis.incr(cntKey);
    if (count === 1) {
      await this.redis.expire(cntKey, HOURLY_WINDOW_MS);
    }
    if (count > SEND_HOURLY_MAX) {
      await this.redis.getClient().decr(cntKey);
      BusinessException.throw(ResponseCode.TOO_MANY_REQUESTS, '该号码验证码获取次数已达上限，请稍后再试');
    }

    const gapKey = this.keys.smsSendGapKey(tenantId, scene, phone);
    const gapOk = await this.redis.getClient().set(gapKey, '1', 'PX', SEND_MIN_INTERVAL_MS, 'NX');
    if (gapOk !== 'OK') {
      await this.redis.getClient().decr(cntKey);
      BusinessException.throw(ResponseCode.TOO_MANY_REQUESTS, '发送过于频繁，请稍后再试');
    }

    const code = this.generateSixDigitCode();
    const codeKey = this.keys.smsCodeKey(tenantId, scene, phone);
    await this.redis.set(codeKey, code, SMS_CODE_TTL_MS);

    try {
      await this.smsOutbound.sendVerificationSms({
        phone,
        code,
        scene,
        tenantId,
        validMinutes: Math.round(SMS_CODE_TTL_MS / 60_000),
      });
    } catch (error) {
      await this.rollbackSendState(codeKey, gapKey, cntKey);
      throw error;
    }
  }

  private async rollbackSendState(codeKey: string, gapKey: string, cntKey: string): Promise<void> {
    try {
      await this.redis.del(codeKey);
      await this.redis.del(gapKey);
      await this.redis.getClient().decr(cntKey);
    } catch (error) {
      this.logger.warn(`短信验证码发送失败后的 Redis 回滚未完全成功: ${String(error)}`);
    }
  }

  /**
   * 校验验证码是否正确且未过期（不消费）
   */
  async verifyOnly(phone: string, scene: SmsVerificationScene, tenantId: string, inputCode: string): Promise<boolean> {
    const codeKey = this.keys.smsCodeKey(tenantId, scene, phone);
    const stored = await this.redis.get(codeKey);
    if (stored === null || stored === undefined) return false;
    const expected = typeof stored === 'string' ? stored : String(stored);
    return expected === inputCode.trim();
  }

  /**
   * 校验通过则删除验证码（单次消费）
   */
  async verifyAndConsume(
    phone: string,
    scene: SmsVerificationScene,
    tenantId: string,
    inputCode: string,
  ): Promise<boolean> {
    const ok = await this.verifyOnly(phone, scene, tenantId, inputCode);
    if (!ok) return false;
    await this.redis.del(this.keys.smsCodeKey(tenantId, scene, phone));
    return true;
  }
}

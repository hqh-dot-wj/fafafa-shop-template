import { Injectable } from '@nestjs/common';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response/response.interface';
import { SmsVerificationScene } from '../constants/sms-verification-scene.enum';
import { PasswordPolicyService } from './password-policy.service';
import { SmsCodeService } from './sms-code.service';

/**
 * 重置密码前置校验：短信码消费 + 新密码策略（具体落库由会员/管理员域 Service 调用方完成）
 */
@Injectable()
export class PasswordResetService {
  constructor(
    private readonly smsCode: SmsCodeService,
    private readonly passwordPolicy: PasswordPolicyService,
  ) {}

  async assertMemberResetCodeConsumed(phone: string, tenantId: string, code: string): Promise<void> {
    const ok = await this.smsCode.verifyAndConsume(phone, SmsVerificationScene.MEMBER_RESET_PASSWORD, tenantId, code);
    BusinessException.throwIf(!ok, '验证码错误或已失效', ResponseCode.PARAM_INVALID);
  }

  async assertAdminResetCodeConsumed(phone: string, tenantId: string, code: string): Promise<void> {
    const ok = await this.smsCode.verifyAndConsume(phone, SmsVerificationScene.ADMIN_RESET_PASSWORD, tenantId, code);
    BusinessException.throwIf(!ok, '验证码错误或已失效', ResponseCode.PARAM_INVALID);
  }

  assertNewPasswordPlain(plain: string): void {
    this.passwordPolicy.assertAcceptable(plain);
  }
}

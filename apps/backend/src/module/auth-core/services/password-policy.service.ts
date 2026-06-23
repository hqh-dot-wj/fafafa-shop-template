import { Injectable } from '@nestjs/common';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response/response.interface';

/** 多因素场景下最低长度（与短信验证码组合时） */
const MIN_LENGTH_WITH_MFA = 8;

/** 常见弱密码（小表，后续可接 HIBP / 自建黑名单） */
const WEAK_PASSWORD_BLOCKLIST = new Set(['password', '12345678', '87654321', 'qwerty123', 'admin123', 'password123']);

@Injectable()
export class PasswordPolicyService {
  /**
   * 校验密码是否符合策略，不通过则抛出业务异常
   */
  assertAcceptable(plain: string): void {
    BusinessException.throwIf(
      !plain || plain.length < MIN_LENGTH_WITH_MFA,
      '密码长度至少 8 位',
      ResponseCode.PASSWORD_WEAK,
    );
    const lower = plain.toLowerCase();
    BusinessException.throwIf(WEAK_PASSWORD_BLOCKLIST.has(lower), '密码过于简单，请更换', ResponseCode.PASSWORD_WEAK);
  }
}

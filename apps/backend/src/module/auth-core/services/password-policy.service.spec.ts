import { Test, TestingModule } from '@nestjs/testing';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response/response.interface';
import { PasswordPolicyService } from './password-policy.service';

describe('PasswordPolicyService', () => {
  let service: PasswordPolicyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordPolicyService],
    }).compile();
    service = module.get(PasswordPolicyService);
  });

  it('长度不足应拒绝', () => {
    expect(() => service.assertAcceptable('short')).toThrow(BusinessException);
    try {
      service.assertAcceptable('short');
    } catch (e) {
      expect((e as BusinessException).errorCode).toBe(ResponseCode.PASSWORD_WEAK);
    }
  });

  it('弱密码应拒绝', () => {
    expect(() => service.assertAcceptable('12345678')).toThrow(BusinessException);
  });

  it('符合策略的密码应通过', () => {
    expect(() => service.assertAcceptable('Xk9m_p.q2')).not.toThrow();
  });
});

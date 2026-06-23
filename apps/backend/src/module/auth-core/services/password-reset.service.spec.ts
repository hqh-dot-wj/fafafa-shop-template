import { Test, TestingModule } from '@nestjs/testing';
import { BusinessException } from 'src/common/exceptions';
import { SmsVerificationScene } from '../constants/sms-verification-scene.enum';
import { PasswordPolicyService } from './password-policy.service';
import { PasswordResetService } from './password-reset.service';
import { SmsCodeService } from './sms-code.service';

describe('PasswordResetService', () => {
  let service: PasswordResetService;

  const mockSmsCodeService = {
    verifyAndConsume: jest.fn(),
  };

  const mockPasswordPolicyService = {
    assertAcceptable: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: SmsCodeService, useValue: mockSmsCodeService },
        { provide: PasswordPolicyService, useValue: mockPasswordPolicyService },
      ],
    }).compile();

    service = module.get<PasswordResetService>(PasswordResetService);
    jest.clearAllMocks();
  });

  it('assertMemberResetCodeConsumed passes when code is valid', async () => {
    mockSmsCodeService.verifyAndConsume.mockResolvedValueOnce(true);

    await service.assertMemberResetCodeConsumed('13800138000', 'tenant-1', '123456');

    expect(mockSmsCodeService.verifyAndConsume).toHaveBeenCalledWith(
      '13800138000',
      SmsVerificationScene.MEMBER_RESET_PASSWORD,
      'tenant-1',
      '123456',
    );
  });

  it('assertMemberResetCodeConsumed throws when code is invalid', async () => {
    mockSmsCodeService.verifyAndConsume.mockResolvedValueOnce(false);

    await expect(service.assertMemberResetCodeConsumed('13800138000', 'tenant-1', '000000')).rejects.toBeInstanceOf(
      BusinessException,
    );

    expect(mockSmsCodeService.verifyAndConsume).toHaveBeenCalledWith(
      '13800138000',
      SmsVerificationScene.MEMBER_RESET_PASSWORD,
      'tenant-1',
      '000000',
    );
  });

  it('assertAdminResetCodeConsumed passes when code is valid', async () => {
    mockSmsCodeService.verifyAndConsume.mockResolvedValueOnce(true);

    await service.assertAdminResetCodeConsumed('13900139000', 'tenant-2', '654321');

    expect(mockSmsCodeService.verifyAndConsume).toHaveBeenCalledWith(
      '13900139000',
      SmsVerificationScene.ADMIN_RESET_PASSWORD,
      'tenant-2',
      '654321',
    );
  });

  it('assertAdminResetCodeConsumed throws when code is invalid', async () => {
    mockSmsCodeService.verifyAndConsume.mockResolvedValueOnce(false);

    await expect(service.assertAdminResetCodeConsumed('13900139000', 'tenant-2', 'bad')).rejects.toBeInstanceOf(
      BusinessException,
    );
  });

  it('assertNewPasswordPlain delegates to password policy', () => {
    service.assertNewPasswordPlain('CorrectHorse123');

    expect(mockPasswordPolicyService.assertAcceptable).toHaveBeenCalledWith('CorrectHorse123');
  });
});

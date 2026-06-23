import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { ClientAuthStrategyFactory } from './strategies';
import { ActivityService } from 'src/module/marketing/activity/activity.service';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { SocialPlatform } from '@prisma/client';
import { BindPhoneDto } from './dto/auth.dto';
import { BusinessException } from 'src/common/exceptions';
import { AppConfigService } from 'src/config/app-config.service';
import { SmsCodeService } from 'src/module/auth-core/services/sms-code.service';
import { PasswordPolicyService } from 'src/module/auth-core/services/password-policy.service';
import { PasswordResetService } from 'src/module/auth-core/services/password-reset.service';
import { SmsVerificationScene } from 'src/module/auth-core/constants/sms-verification-scene.enum';
import { UploadService } from 'src/module/admin/upload/upload.service';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = {
    umsMember: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    sysTenant: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockStrategy = {
    resolvePhone: jest.fn(),
  };

  const mockStrategyFactory = {
    getStrategy: jest.fn().mockReturnValue(mockStrategy),
  };

  const mockAppConfig = {
    jwt: {
      secretkey: 'test-secret-key-32chars-minimum',
      expiresin: '1h',
      refreshExpiresIn: '2h',
    },
  };

  const mockSmsCode = {
    sendCode: jest.fn().mockResolvedValue(undefined),
    verifyAndConsume: jest.fn(),
  };

  const mockPasswordPolicy = {
    assertAcceptable: jest.fn(),
  };

  const mockPasswordReset = {
    assertMemberResetCodeConsumed: jest.fn().mockResolvedValue(undefined),
  };

  const mockUploadService = {
    uploadFromBuffer: jest.fn(),
  };

  const mockRedis = { set: jest.fn(), del: jest.fn(), get: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('jwt-token'),
            verify: jest.fn(),
            decode: jest.fn(),
          },
        },
        { provide: RedisService, useValue: mockRedis },
        { provide: ClientAuthStrategyFactory, useValue: mockStrategyFactory },
        { provide: ActivityService, useValue: { onPhoneBound: jest.fn().mockResolvedValue(undefined) } },
        getTenantHelperTestProvider(),
        { provide: AppConfigService, useValue: mockAppConfig },
        { provide: SmsCodeService, useValue: mockSmsCode },
        { provide: PasswordPolicyService, useValue: mockPasswordPolicy },
        { provide: PasswordResetService, useValue: mockPasswordReset },
        { provide: UploadService, useValue: mockUploadService },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
    mockStrategyFactory.getStrategy.mockReturnValue(mockStrategy);
    mockPrisma.sysTenant.findUnique.mockResolvedValue({ tenantId: '000000' });
  });

  describe('bindPhone', () => {
    it('手机号未被占用时应更新当前用户', async () => {
      mockStrategy.resolvePhone.mockResolvedValue('13800000000');
      mockPrisma.umsMember.findFirst.mockResolvedValue(null);
      mockPrisma.umsMember.update.mockResolvedValue({
        memberId: 'm1',
        mobile: '13800000000',
      });

      const dto: BindPhoneDto = { phoneCode: 'code' };
      const res = await service.bindPhone('m1', dto, SocialPlatform.MP_MALL);

      expect(res.data?.userInfo.mobile).toBe('13800000000');
      expect(mockPrisma.umsMember.findFirst).toHaveBeenCalled();
      expect(mockPrisma.umsMember.update).toHaveBeenCalledWith({
        where: { memberId: 'm1' },
        data: { mobile: '13800000000' },
      });
    });

    it('手机号已被其他账号占用时应拒绝', async () => {
      mockStrategy.resolvePhone.mockResolvedValue('13800000000');
      mockPrisma.umsMember.findFirst.mockResolvedValue({
        memberId: 'other',
        mobile: '13800000000',
      });

      const dto: BindPhoneDto = { phoneCode: 'code' };
      try {
        await service.bindPhone('m1', dto, SocialPlatform.MP_MALL);
        expect.fail('应抛出 BusinessException');
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).getResponse()).toMatchObject({
          msg: '该手机号已被其他账号绑定',
        });
      }
    });
  });

  describe('sendLoginCode', () => {
    it('应调用短信发送', async () => {
      await service.sendLoginCode({ mobile: '13800138000' });
      expect(mockSmsCode.sendCode).toHaveBeenCalledWith('13800138000', expect.any(String), '000000');
    });
  });

  describe('loginOrRegisterBySms', () => {
    const dto = { mobile: '13800138000', code: '123456' };

    it('验证码正确且手机号已注册时应直接登录', async () => {
      mockSmsCode.verifyAndConsume.mockResolvedValue(true);
      mockPrisma.umsMember.findFirst.mockResolvedValue({
        memberId: 'm1',
        mobile: '13800138000',
        status: 'NORMAL',
      });

      const res = await service.loginOrRegisterBySms(dto);

      expect(res.data.access_token).toBe('jwt-token');
      expect(res.data.isNew).toBeFalsy();
    });

    it('验证码正确且手机号未注册时应自动注册', async () => {
      mockSmsCode.verifyAndConsume.mockResolvedValue(true);
      mockPrisma.umsMember.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => Promise<unknown>) =>
        cb(mockPrisma),
      );
      mockPrisma.umsMember.create.mockResolvedValue({
        memberId: 'm-new',
        mobile: '13800138000',
        status: 'NORMAL',
      });

      const res = await service.loginOrRegisterBySms(dto);

      expect(res.data.isNew).toBe(true);
      expect(res.data.access_token).toBe('jwt-token');
      expect(mockPrisma.umsMember.create).toHaveBeenCalled();
    });

    it('验证码错误或已失效时应拒绝', async () => {
      mockSmsCode.verifyAndConsume.mockResolvedValue(false);

      await expect(service.loginOrRegisterBySms(dto)).rejects.toThrow(BusinessException);
    });

    it('已注册但账号已禁用时应拒绝', async () => {
      mockSmsCode.verifyAndConsume.mockResolvedValue(true);
      mockPrisma.umsMember.findFirst.mockResolvedValue({
        memberId: 'm1',
        mobile: '13800138000',
        status: 'DISABLED',
      });

      await expect(service.loginOrRegisterBySms(dto)).rejects.toThrow(BusinessException);
    });
  });

  describe('passwordLogin', () => {
    const hashedPw = bcrypt.hashSync('StrongP@ss1', bcrypt.genSaltSync(10));

    it('密码正确时应成功登录', async () => {
      mockPrisma.umsMember.findFirst.mockResolvedValue({
        memberId: 'm1',
        mobile: '13800138000',
        status: 'NORMAL',
        password: hashedPw,
      });

      const res = await service.passwordLogin({ mobile: '13800138000', password: 'StrongP@ss1' });

      expect(res.data.access_token).toBe('jwt-token');
    });

    it('密码错误时应拒绝', async () => {
      mockPrisma.umsMember.findFirst.mockResolvedValue({
        memberId: 'm1',
        mobile: '13800138000',
        status: 'NORMAL',
        password: hashedPw,
      });

      await expect(service.passwordLogin({ mobile: '13800138000', password: 'WrongPass' })).rejects.toThrow(
        BusinessException,
      );
    });

    it('账号不存在时应拒绝', async () => {
      mockPrisma.umsMember.findFirst.mockResolvedValue(null);

      await expect(service.passwordLogin({ mobile: '13800138000', password: 'StrongP@ss1' })).rejects.toThrow(
        BusinessException,
      );
    });

    it('账号已禁用时应拒绝', async () => {
      mockPrisma.umsMember.findFirst.mockResolvedValue({
        memberId: 'm1',
        mobile: '13800138000',
        status: 'DISABLED',
        password: hashedPw,
      });

      await expect(service.passwordLogin({ mobile: '13800138000', password: 'StrongP@ss1' })).rejects.toThrow(
        BusinessException,
      );
    });

    it('未设置密码时应拒绝', async () => {
      mockPrisma.umsMember.findFirst.mockResolvedValue({
        memberId: 'm1',
        mobile: '13800138000',
        status: 'NORMAL',
        password: null,
      });

      await expect(service.passwordLogin({ mobile: '13800138000', password: 'StrongP@ss1' })).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('sendResetCode', () => {
    it('已注册手机号应发送验证码', async () => {
      mockPrisma.umsMember.findFirst.mockResolvedValue({
        memberId: 'm1',
        mobile: '13800138000',
      });

      const res = await service.sendResetCode({ mobile: '13800138000' });

      expect(res.code).toBe(200);
      expect(mockSmsCode.sendCode).toHaveBeenCalledWith(
        '13800138000',
        SmsVerificationScene.MEMBER_RESET_PASSWORD,
        '000000',
      );
    });

    it('未注册手机号不发送但返回成功（防枚举）', async () => {
      mockPrisma.umsMember.findFirst.mockResolvedValue(null);

      const res = await service.sendResetCode({ mobile: '13800138000' });

      expect(res.code).toBe(200);
      expect(mockSmsCode.sendCode).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('验证通过后应重置密码', async () => {
      mockPrisma.umsMember.findFirst.mockResolvedValue({
        memberId: 'm1',
        mobile: '13800138000',
      });
      mockPrisma.umsMember.update.mockResolvedValue({});

      const res = await service.resetPassword({
        mobile: '13800138000',
        code: '123456',
        newPassword: 'NewStr0ngP@ss',
      });

      expect(res.code).toBe(200);
      expect(mockPasswordReset.assertMemberResetCodeConsumed).toHaveBeenCalled();
      expect(mockPasswordPolicy.assertAcceptable).toHaveBeenCalledWith('NewStr0ngP@ss');
      expect(mockPrisma.umsMember.update).toHaveBeenCalled();
    });

    it('弱密码时应拒绝', async () => {
      mockPrisma.umsMember.findFirst.mockResolvedValue({
        memberId: 'm1',
        mobile: '13800138000',
      });
      mockPasswordPolicy.assertAcceptable.mockImplementationOnce(() => {
        throw new BusinessException(500, '密码强度不足');
      });

      await expect(
        service.resetPassword({ mobile: '13800138000', code: '123456', newPassword: '123' }),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('logout', () => {
    let jwtDecode: jest.Mock;

    beforeEach(() => {
      const jwt = service['jwtService'] as { decode: jest.Mock };
      jwtDecode = jwt.decode;
      jwtDecode.mockReset();
      mockRedis.del.mockClear();
    });

    it('无 Authorization 时应返回统一 Result 且不删 Redis', async () => {
      const res = await service.logout(undefined);

      expect(res.code).toBe(200);
      expect(res.msg).toBe('退出成功');
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('access token 应删除对应会话 key', async () => {
      jwtDecode.mockReturnValue({ uuid: 'acc-uuid-1', typ: 'access' });

      const res = await service.logout('Bearer fake.jwt');

      expect(res.code).toBe(200);
      expect(mockRedis.del).toHaveBeenCalledWith('login_tokens:acc-uuid-1');
    });

    it('refresh token 不应按 access 会话删除', async () => {
      jwtDecode.mockReturnValue({ uuid: 'ref-uuid-1', typ: 'refresh' });

      const res = await service.logout('Bearer fake.jwt');

      expect(res.code).toBe(200);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('setPassword', () => {
    it('合法密码时应更新', async () => {
      mockPrisma.umsMember.update.mockResolvedValue({});

      const res = await service.setPassword('m1', { newPassword: 'NewStr0ngP@ss' });

      expect(res.code).toBe(200);
      expect(mockPasswordPolicy.assertAcceptable).toHaveBeenCalledWith('NewStr0ngP@ss');
      expect(mockPrisma.umsMember.update).toHaveBeenCalledWith(expect.objectContaining({ where: { memberId: 'm1' } }));
    });

    it('弱密码时应拒绝', async () => {
      mockPasswordPolicy.assertAcceptable.mockImplementationOnce(() => {
        throw new BusinessException(500, '密码强度不足');
      });

      await expect(service.setPassword('m1', { newPassword: '123' })).rejects.toThrow(BusinessException);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response/response.interface';
import { RedisService } from 'src/module/common/redis/redis.service';
import { SmsOutboundFacade } from 'src/module/notification/channels/sms-outbound.facade';
import { SmsVerificationScene } from '../constants/sms-verification-scene.enum';
import { SmsCodeService } from './sms-code.service';
import { VerificationCodeService } from './verification-code.service';

describe('SmsCodeService', () => {
  let service: SmsCodeService;
  const tenantId = 't1';
  const phone = '13800138000';
  const scene = SmsVerificationScene.MEMBER_LOGIN;

  const mockRedisClient = {
    set: jest.fn(),
    decr: jest.fn(),
  };

  const mockRedis = {
    getClient: jest.fn(() => mockRedisClient),
    incr: jest.fn(),
    expire: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    set: jest.fn(),
  };

  const mockSmsOutbound = {
    sendVerificationSms: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedisClient.set.mockResolvedValue('OK');
    mockRedisClient.decr.mockResolvedValue(1);
    mockRedis.incr.mockReset();
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.get.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsCodeService,
        VerificationCodeService,
        { provide: RedisService, useValue: mockRedis },
        { provide: SmsOutboundFacade, useValue: mockSmsOutbound },
      ],
    }).compile();

    service = module.get(SmsCodeService);
  });

  it('sendCode 应写入 Redis 并调用短信外发', async () => {
    await service.sendCode(phone, scene, tenantId);

    expect(mockRedis.incr).toHaveBeenCalled();
    expect(mockRedis.set).toHaveBeenCalled();
    expect(mockSmsOutbound.sendVerificationSms).toHaveBeenCalledWith(
      expect.objectContaining({
        phone,
        scene,
        tenantId,
        validMinutes: 5,
        code: expect.stringMatching(/^\d{6}$/),
      }),
    );
  });

  it('verifyOnly 在验证码错误时应返回 false', async () => {
    mockRedis.get.mockResolvedValue('111111');
    await expect(service.verifyOnly(phone, scene, tenantId, '222222')).resolves.toBe(false);
  });

  it('verifyAndConsume 正确时应删除验证码并返回 true', async () => {
    mockRedis.get.mockResolvedValue('123456');
    await expect(service.verifyAndConsume(phone, scene, tenantId, '123456')).resolves.toBe(true);
    expect(mockRedis.del).toHaveBeenCalled();
  });

  it('verifyAndConsume 错误时应返回 false 且不删除', async () => {
    mockRedis.get.mockResolvedValue('123456');
    await expect(service.verifyAndConsume(phone, scene, tenantId, '000000')).resolves.toBe(false);
    expect(mockRedis.del).not.toHaveBeenCalled();
  });

  it('发送间隔过短应抛出 TOO_MANY_REQUESTS', async () => {
    mockRedis.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    mockRedisClient.set.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);
    await service.sendCode(phone, scene, tenantId);
    await expect(service.sendCode(phone, scene, tenantId)).rejects.toMatchObject({
      errorCode: ResponseCode.TOO_MANY_REQUESTS,
    });
    expect(mockRedisClient.decr).toHaveBeenCalled();
  });

  it('小时发送次数超限时拒绝并回滚计数', async () => {
    mockRedis.incr.mockResolvedValueOnce(11);
    await expect(service.sendCode(phone, scene, tenantId)).rejects.toMatchObject({
      errorCode: ResponseCode.TOO_MANY_REQUESTS,
    });
    expect(mockRedisClient.decr).toHaveBeenCalledWith(cntKeyFor(phone, scene, tenantId));
  });

  it('短信外发失败时应清理验证码、发送间隔并回滚计数', async () => {
    mockSmsOutbound.sendVerificationSms.mockRejectedValueOnce(new BusinessException(ResponseCode.SERVICE_UNAVAILABLE));

    await expect(service.sendCode(phone, scene, tenantId)).rejects.toThrow(BusinessException);

    expect(mockRedis.del).toHaveBeenCalledWith(codeKeyFor(phone, scene, tenantId));
    expect(mockRedis.del).toHaveBeenCalledWith(gapKeyFor(phone, scene, tenantId));
    expect(mockRedisClient.decr).toHaveBeenCalledWith(cntKeyFor(phone, scene, tenantId));
  });

  describe('完整流程：发送 → 验证 → 消费 → 二次消费拒绝', () => {
    it('应模拟真实的短信验证码使用场景', async () => {
      // 1. 发送验证码
      await service.sendCode(phone, scene, tenantId);
      expect(mockSmsOutbound.sendVerificationSms).toHaveBeenCalledTimes(1);
      const sentPayload = mockSmsOutbound.sendVerificationSms.mock.calls[0][0];
      const sentCode = sentPayload.code;
      expect(sentCode).toMatch(/^\d{6}$/);

      // 2. 模拟 Redis 存了这个验证码
      mockRedis.get.mockResolvedValue(sentCode);

      // 3. 验证码正确时 verifyOnly 返回 true
      const verifyOk = await service.verifyOnly(phone, scene, tenantId, sentCode);
      expect(verifyOk).toBe(true);

      // 4. 验证码错误时 verifyOnly 返回 false
      const verifyBad = await service.verifyOnly(phone, scene, tenantId, '000000');
      expect(verifyBad).toBe(false);

      // 5. 消费验证码
      const consumeOk = await service.verifyAndConsume(phone, scene, tenantId, sentCode);
      expect(consumeOk).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledTimes(1);

      // 6. 模拟 Redis 已删除验证码
      mockRedis.get.mockResolvedValue(null);

      // 7. 二次消费应失败
      const consumeAgain = await service.verifyAndConsume(phone, scene, tenantId, sentCode);
      expect(consumeAgain).toBe(false);
      expect(mockRedis.del).toHaveBeenCalledTimes(1);
    });
  });

  describe('多场景隔离', () => {
    it('不同场景的验证码互不影响', async () => {
      const memberScene = SmsVerificationScene.MEMBER_LOGIN;
      const resetScene = SmsVerificationScene.MEMBER_RESET_PASSWORD;

      await service.sendCode(phone, memberScene, tenantId);
      const loginPayload = mockSmsOutbound.sendVerificationSms.mock.calls[0][0];

      // 重置间隔限制的 mock
      mockRedis.incr.mockResolvedValue(1);
      mockRedisClient.set.mockResolvedValue('OK');

      await service.sendCode(phone, resetScene, tenantId);
      const resetPayload = mockSmsOutbound.sendVerificationSms.mock.calls[1][0];

      expect(loginPayload.scene).toBe('member_login');
      expect(resetPayload.scene).toBe('member_reset_password');
      expect(loginPayload.code).not.toBe(resetPayload.code);
    });
  });
});

function cntKeyFor(phone: string, scene: SmsVerificationScene, tenantId: string): string {
  return `auth:sms:cnt:hour:${tenantId}:${scene}:${phone}`;
}

function codeKeyFor(phone: string, scene: SmsVerificationScene, tenantId: string): string {
  return `auth:sms:code:${tenantId}:${scene}:${phone}`;
}

function gapKeyFor(phone: string, scene: SmsVerificationScene, tenantId: string): string {
  return `auth:sms:gap:${tenantId}:${scene}:${phone}`;
}

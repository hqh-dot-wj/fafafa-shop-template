import { Test, TestingModule } from '@nestjs/testing';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response/response.interface';
import { AppConfigService } from 'src/config/app-config.service';
import { AliyunSmsProvider } from './providers/aliyun-sms.provider';
import { StubSmsProvider } from './providers/stub-sms.provider';
import { SmsOutboundFacade } from './sms-outbound.facade';

describe('SmsOutboundFacade', () => {
  let facade: SmsOutboundFacade;

  const mockStub = {
    sendVerificationCode: jest.fn().mockResolvedValue(undefined),
    sendPlainText: jest.fn().mockResolvedValue(undefined),
  };

  const mockAliyun = {
    isReady: jest.fn(),
    sendVerificationCode: jest.fn().mockResolvedValue(undefined),
    sendPlainText: jest.fn().mockResolvedValue(undefined),
  };

  const mockAppConfig = {
    isProduction: false,
  };

  const verificationPayload = {
    phone: '13800138000',
    code: '123456',
    scene: 'member_login',
    tenantId: 't1',
    validMinutes: 5,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAliyun.isReady.mockReturnValue(false);
    mockAppConfig.isProduction = false;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsOutboundFacade,
        { provide: StubSmsProvider, useValue: mockStub },
        { provide: AliyunSmsProvider, useValue: mockAliyun },
        { provide: AppConfigService, useValue: mockAppConfig },
      ],
    }).compile();

    facade = module.get(SmsOutboundFacade);
  });

  describe('sendVerificationSms', () => {
    it('开发环境未配置阿里云时走 Stub 并成功', async () => {
      mockAliyun.isReady.mockReturnValue(false);
      mockAppConfig.isProduction = false;

      await facade.sendVerificationSms(verificationPayload);

      expect(mockStub.sendVerificationCode).toHaveBeenCalledWith(verificationPayload);
      expect(mockAliyun.sendVerificationCode).not.toHaveBeenCalled();
    });

    it('阿里云已配置时走阿里云', async () => {
      mockAliyun.isReady.mockReturnValue(true);

      await facade.sendVerificationSms(verificationPayload);

      expect(mockAliyun.sendVerificationCode).toHaveBeenCalledWith(verificationPayload);
      expect(mockStub.sendVerificationCode).not.toHaveBeenCalled();
    });

    it('生产环境未配置阿里云时应拒绝发送', async () => {
      mockAliyun.isReady.mockReturnValue(false);
      mockAppConfig.isProduction = true;

      await expect(facade.sendVerificationSms(verificationPayload)).rejects.toThrow(BusinessException);
    });

    it('阿里云发送失败时异常应传播到调用方', async () => {
      mockAliyun.isReady.mockReturnValue(true);
      mockAliyun.sendVerificationCode.mockRejectedValueOnce(
        new BusinessException(ResponseCode.SERVICE_UNAVAILABLE, '短信发送失败'),
      );

      await expect(facade.sendVerificationSms(verificationPayload)).rejects.toThrow(BusinessException);
    });
  });

  describe('sendNotificationSms', () => {
    const message = { content: '您的订单已发货', tenantId: 't1' };

    it('开发环境未配置阿里云时走 Stub 并返回成功', async () => {
      mockAliyun.isReady.mockReturnValue(false);
      mockAppConfig.isProduction = false;

      const result = await facade.sendNotificationSms('13800138000', message as any);

      expect(result.success).toBe(true);
      expect(mockStub.sendPlainText).toHaveBeenCalled();
    });

    it('生产环境未配置阿里云时返回失败但不抛异常', async () => {
      mockAliyun.isReady.mockReturnValue(false);
      mockAppConfig.isProduction = true;

      const result = await facade.sendNotificationSms('13800138000', message as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('未配置');
    });

    it('阿里云发送成功时返回成功', async () => {
      mockAliyun.isReady.mockReturnValue(true);

      const result = await facade.sendNotificationSms('13800138000', message as any);

      expect(result.success).toBe(true);
      expect(mockAliyun.sendPlainText).toHaveBeenCalled();
    });

    it('阿里云发送失败时返回失败但不抛异常', async () => {
      mockAliyun.isReady.mockReturnValue(true);
      mockAliyun.sendPlainText.mockRejectedValueOnce(new Error('网络超时'));

      const result = await facade.sendNotificationSms('13800138000', message as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('网络超时');
    });
  });
});

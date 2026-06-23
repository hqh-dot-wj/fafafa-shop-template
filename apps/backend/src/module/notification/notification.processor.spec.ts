import { Test, TestingModule } from '@nestjs/testing';
import { NotificationProcessor } from './notification.processor';
import { PrismaService } from 'src/prisma/prisma.service';
import { InAppChannel } from './channels/in-app.channel';
import { SmsChannel } from './channels/sms.channel';
import { WechatTemplateChannel } from './channels/wechat-template.channel';
import { AppPushChannel } from './channels/app-push.channel';
import { SseService } from 'src/module/admin/resource/sse.service';

describe('NotificationProcessor', () => {
  let processor: NotificationProcessor;

  const mockPrisma = {
    sysNotificationLog: {
      update: jest.fn().mockResolvedValue({}),
    },
  };

  const mockInApp = { send: jest.fn().mockResolvedValue({ success: true, messageId: 1001 }) };
  const mockSms = { send: jest.fn().mockResolvedValue({ success: true }) };
  const mockWechat = { send: jest.fn().mockResolvedValue({ success: true }) };
  const mockAppPush = { send: jest.fn().mockResolvedValue({ success: true }) };
  const mockSse = { pushInAppNotification: jest.fn() };

  const baseMessage = {
    content: 'test notification',
    tenantId: 'tenant-1',
  };

  const createJob = (data: object) => ({ data }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InAppChannel, useValue: mockInApp },
        { provide: SmsChannel, useValue: mockSms },
        { provide: WechatTemplateChannel, useValue: mockWechat },
        { provide: AppPushChannel, useValue: mockAppPush },
        { provide: SseService, useValue: mockSse },
      ],
    }).compile();

    processor = module.get<NotificationProcessor>(NotificationProcessor);
    jest.clearAllMocks();
    mockPrisma.sysNotificationLog.update.mockResolvedValue({});
  });

  describe('handleNotification - success flow', () => {
    it('updates status to SENDING before dispatch', async () => {
      mockInApp.send.mockResolvedValue({ success: true });

      await processor.handleNotification(
        createJob({
          logId: 1,
          channel: 'IN_APP',
          target: 'member-1',
          message: baseMessage,
        }),
      );

      expect(mockPrisma.sysNotificationLog.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ data: { status: 'SENDING' } }),
      );
    });

    it('updates status to SENT after successful dispatch', async () => {
      mockInApp.send.mockResolvedValue({ success: true });

      await processor.handleNotification(
        createJob({
          logId: 1,
          channel: 'IN_APP',
          target: 'member-1',
          message: baseMessage,
        }),
      );

      expect(mockPrisma.sysNotificationLog.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SENT' }),
        }),
      );
    });

    it('pushes SSE when in-app message id is returned', async () => {
      mockInApp.send.mockResolvedValue({ success: true, messageId: 42 });

      await processor.handleNotification(
        createJob({
          logId: 9,
          channel: 'IN_APP',
          target: '1',
          message: { ...baseMessage, title: 'title-a', template: 'ORDER' },
        }),
      );

      expect(mockSse.pushInAppNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          target: '1',
          tenantId: 'tenant-1',
          payload: expect.stringContaining('"kind":"in_app_message"'),
        }),
      );
    });

    it('stores provider message id when channel returns it', async () => {
      mockSms.send.mockResolvedValue({ success: true, providerMessageId: 'sms-provider-1001' });

      await processor.handleNotification(
        createJob({
          logId: 10,
          channel: 'SMS',
          target: '13800138000',
          message: baseMessage,
        }),
      );

      expect(mockPrisma.sysNotificationLog.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SENT',
            providerMessageId: 'sms-provider-1001',
          }),
        }),
      );
    });

    it('routes SMS channel to SmsChannel.send', async () => {
      await processor.handleNotification(
        createJob({
          logId: 2,
          channel: 'SMS',
          target: '13800138000',
          message: baseMessage,
        }),
      );

      expect(mockSms.send).toHaveBeenCalledWith('13800138000', baseMessage);
      expect(mockInApp.send).not.toHaveBeenCalled();
    });

    it('routes WECHAT_TEMPLATE channel to WechatTemplateChannel.send', async () => {
      await processor.handleNotification(
        createJob({
          logId: 3,
          channel: 'WECHAT_TEMPLATE',
          target: 'openid-xxx',
          message: baseMessage,
        }),
      );

      expect(mockWechat.send).toHaveBeenCalledWith('openid-xxx', baseMessage);
    });

    it('routes APP_PUSH channel to AppPushChannel.send', async () => {
      await processor.handleNotification(
        createJob({
          logId: 4,
          channel: 'APP_PUSH',
          target: 'device-token',
          message: baseMessage,
        }),
      );

      expect(mockAppPush.send).toHaveBeenCalledWith('device-token', baseMessage);
    });
  });

  describe('handleNotification - failure flow', () => {
    it('marks FAILED and throws when channel returns success=false', async () => {
      mockInApp.send.mockResolvedValue({ success: false, error: 'write failed' });

      await expect(
        processor.handleNotification(
          createJob({
            logId: 5,
            channel: 'IN_APP',
            target: 'member-1',
            message: baseMessage,
          }),
        ),
      ).rejects.toThrow();

      expect(mockPrisma.sysNotificationLog.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });

    it('marks FAILED and rethrows when channel throws', async () => {
      mockSms.send.mockRejectedValue(new Error('network timeout'));

      await expect(
        processor.handleNotification(
          createJob({
            logId: 6,
            channel: 'SMS',
            target: '13800138000',
            message: baseMessage,
          }),
        ),
      ).rejects.toThrow('network timeout');

      expect(mockPrisma.sysNotificationLog.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED', errorMsg: 'network timeout' }),
        }),
      );
    });

    it('throws unknown channel error for unsupported channel', async () => {
      await expect(
        processor.handleNotification(
          createJob({
            logId: 7,
            channel: 'UNKNOWN_CHANNEL',
            target: 'member-1',
            message: baseMessage,
          }),
        ),
      ).rejects.toThrow('Unknown notification channel: UNKNOWN_CHANNEL');
    });
  });
});

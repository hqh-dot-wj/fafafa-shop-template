import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { NotificationService, NOTIFICATION_QUEUE } from './notification.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationPolicyService } from './policy/notification-policy.service';

describe('NotificationService', () => {
  let service: NotificationService;

  const mockLog = { id: 1 };

  const mockPrisma = {
    sysNotificationLog: {
      create: jest.fn().mockResolvedValue(mockLog),
    },
  };

  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  };

  const mockPolicyService = {
    evaluate: jest.fn().mockReturnValue({
      allowed: true,
      snapshot: {
        allowed: true,
        quietHoursMatched: false,
        consentGranted: true,
        frequencyExceeded: false,
        suppressionMatched: false,
        evaluatedAt: '2026-04-19T00:00:00.000Z',
      },
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken(NOTIFICATION_QUEUE), useValue: mockQueue },
        { provide: NotificationPolicyService, useValue: mockPolicyService },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    jest.clearAllMocks();
    mockPrisma.sysNotificationLog.create.mockResolvedValue(mockLog);
    mockQueue.add.mockResolvedValue({ id: 'job-1' });
    mockPolicyService.evaluate.mockReturnValue({
      allowed: true,
      snapshot: {
        allowed: true,
        quietHoursMatched: false,
        consentGranted: true,
        frequencyExceeded: false,
        suppressionMatched: false,
        evaluatedAt: '2026-04-19T00:00:00.000Z',
      },
    });
  });

  describe('send', () => {
    it('creates log and enqueues job for in-app channel', async () => {
      await service.send({
        target: 'member-1',
        channel: 'IN_APP',
        title: 'test-title',
        content: 'test-content',
        tenantId: 'tenant-1',
      });

      expect(mockPrisma.sysNotificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          channel: 'IN_APP',
          target: 'member-1',
          title: 'test-title',
          content: 'test-content',
          status: 'QUEUED',
        }),
      });
      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          logId: mockLog.id,
          channel: 'IN_APP',
          target: 'member-1',
        }),
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        }),
      );
    });

    it('writes null title and template when absent', async () => {
      await service.send({
        target: 'member-1',
        channel: 'SMS',
        content: 'code 1234',
        tenantId: 'tenant-1',
      });

      expect(mockPrisma.sysNotificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: null,
          template: null,
        }),
      });
    });

    it('always configures queue retries as exponential backoff', async () => {
      await service.send({
        target: 'member-1',
        channel: 'WECHAT_TEMPLATE',
        content: 'order notification',
        tenantId: 'tenant-1',
      });

      expect(mockQueue.add).toHaveBeenCalledWith(expect.any(Object), {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      });
    });

    it('passes params and tenant into queue message', async () => {
      await service.send({
        target: 'member-1',
        channel: 'WECHAT_TEMPLATE',
        template: 'ORDER_CREATED',
        content: 'order created',
        params: { orderSn: 'SN001' },
        tenantId: 'tenant-1',
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({
            template: 'ORDER_CREATED',
            params: { orderSn: 'SN001' },
            tenantId: 'tenant-1',
          }),
        }),
        expect.any(Object),
      );
    });

    it('marks log as failed and skips queue when policy rejects', async () => {
      mockPolicyService.evaluate.mockReturnValue({
        allowed: false,
        reason: 'QUIET_HOURS',
        message: 'Current time falls into quiet hours',
        snapshot: {
          allowed: false,
          reason: 'QUIET_HOURS',
          quietHoursMatched: true,
          consentGranted: true,
          frequencyExceeded: false,
          suppressionMatched: false,
          evaluatedAt: '2026-04-19T23:15:00.000Z',
        },
      });

      await service.send({
        target: 'member-1',
        channel: 'IN_APP',
        template: 'MKT_ACTIVITY_SUCCESS_V1',
        templateVersion: 'v1',
        content: 'activity success',
        tenantId: 'tenant-1',
        dispatchContext: {
          bizType: 'MARKETING_ACTIVITY',
          bizRefId: 'activity_001',
          activityId: 'activity_001',
          touchpointCode: 'SUCCESS_WELCOME',
          touchpointKind: 'MESSAGE',
          requestedAt: new Date('2026-04-19T23:15:00+08:00'),
        },
      });

      expect(mockPrisma.sysNotificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'FAILED',
          errorMsg: 'Current time falls into quiet hours',
          bizType: 'MARKETING_ACTIVITY',
          activityId: 'activity_001',
          touchpointCode: 'SUCCESS_WELCOME',
        }),
      });
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('sendMulti', () => {
    it('invokes send once per channel', async () => {
      const sendSpy = jest.spyOn(service, 'send').mockResolvedValue();

      await service.sendMulti('member-1', ['IN_APP', 'SMS'], {
        content: 'multi channel',
        tenantId: 'tenant-1',
      });

      expect(sendSpy).toHaveBeenCalledTimes(2);
      expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({ target: 'member-1', channel: 'IN_APP' }));
      expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({ target: 'member-1', channel: 'SMS' }));
    });

    it('does not call send when channel list is empty', async () => {
      const sendSpy = jest.spyOn(service, 'send').mockResolvedValue();

      await service.sendMulti('member-1', [], {
        content: 'notification',
        tenantId: 'tenant-1',
      });

      expect(sendSpy).not.toHaveBeenCalled();
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { SmsChannel } from './sms.channel';
import { SmsOutboundFacade } from './sms-outbound.facade';

describe('SmsChannel', () => {
  let channel: SmsChannel;

  const mockSmsOutbound = {
    sendNotificationSms: jest.fn(async () => ({ success: true })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SmsChannel, { provide: SmsOutboundFacade, useValue: mockSmsOutbound }],
    }).compile();

    channel = module.get<SmsChannel>(SmsChannel);
    jest.clearAllMocks();
  });

  it('delegates send to SmsOutboundFacade.sendNotificationSms', async () => {
    const message = { content: '验证码：123456', tenantId: 'tenant-1' };
    const result = await channel.send('13800138000', message);

    expect(mockSmsOutbound.sendNotificationSms).toHaveBeenCalledWith('13800138000', message);
    expect(result).toEqual({ success: true });
  });

  it('returns facade failure without throwing', async () => {
    mockSmsOutbound.sendNotificationSms.mockResolvedValueOnce({
      success: false,
      error: '短信服务未配置',
    });

    const result = await channel.send('13800138000', {
      content: 'hi',
      tenantId: 'tenant-1',
    });

    expect(result).toEqual({ success: false, error: '短信服务未配置' });
  });
});

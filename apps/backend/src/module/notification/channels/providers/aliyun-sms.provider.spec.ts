import Dysmsapi from '@alicloud/dysmsapi20170525';
import { AliyunSmsProvider } from './aliyun-sms.provider';

jest.mock('@alicloud/dysmsapi20170525', () => {
  const sendSms = jest.fn();
  const MockClient = jest.fn().mockImplementation(() => ({
    sendSms,
  }));
  const MockSendSmsRequest = jest.fn().mockImplementation((payload) => payload);

  return {
    __esModule: true,
    default: MockClient,
    SendSmsRequest: MockSendSmsRequest,
  };
});

describe('AliyunSmsProvider', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ALIYUN_SMS_ACCESS_KEY_ID = 'test-key-id';
    process.env.ALIYUN_SMS_ACCESS_KEY_SECRET = 'test-key-secret';
    process.env.ALIYUN_SMS_SIGN_NAME = 'TestSign';
    process.env.ALIYUN_SMS_REGION_ID = 'cn-hangzhou';
    process.env.ALIYUN_SMS_TEMPLATE_MEMBER_LOGIN = 'SMS_000001';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('calls the aliyun sms client when fully configured', async () => {
    const sendSms = jest.fn(async () => ({ body: { code: 'OK', message: 'OK' } }));
    const MockClient = Dysmsapi as unknown as jest.Mock;
    MockClient.mockImplementation(() => ({ sendSms }));

    const provider = new AliyunSmsProvider();
    await provider.sendVerificationCode({
      phone: '13800138000',
      code: '123456',
      scene: 'member_login',
      tenantId: 'tenant-1',
      validMinutes: 5,
    });

    expect(MockClient).toHaveBeenCalled();
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(sendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumbers: '13800138000',
        signName: 'TestSign',
        templateCode: 'SMS_000001',
        templateParam: JSON.stringify({ code: '123456', min: '5' }),
      }),
    );
  });
});

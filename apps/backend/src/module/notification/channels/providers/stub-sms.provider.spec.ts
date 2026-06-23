import { Logger } from '@nestjs/common';
import { StubSmsProvider } from './stub-sms.provider';

describe('StubSmsProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs verification SMS payload', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const provider = new StubSmsProvider();

    await provider.sendVerificationCode({
      phone: '13800138000',
      code: '123456',
      scene: 'member_login',
      tenantId: 'tenant-1',
      validMinutes: 5,
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [message] = logSpy.mock.calls[0] as [string];
    expect(message).toContain('tenant-1');
    expect(message).toContain('member_login');
    expect(message).toContain('13800138000');
    expect(message).toContain('123456');
  });

  it('logs plain text notification payload', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const provider = new StubSmsProvider();

    await provider.sendPlainText({
      phone: '13800138000',
      text: '订单已发货',
      tenantId: 'tenant-1',
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [message] = logSpy.mock.calls[0] as [string];
    expect(message).toContain('[SMS Stub][通知]');
    expect(message).toContain('订单已发货');
  });
});

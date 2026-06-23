import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Request } from 'express';
import { ErrorEventService } from 'src/common/observability';
import { ErrorEventReportController } from './error-event-report.controller';
import { ReportErrorEventDto } from './dto/report-error-event.dto';

async function validationMessages(input: Record<string, unknown>): Promise<string[]> {
  const instance = plainToInstance(ReportErrorEventDto, input, {
    enableImplicitConversion: true,
  });
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: false,
  });

  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('ErrorEventReportController', () => {
  const basePayload = {
    app: 'admin-web',
    errorCode: 'CLIENT_RENDER_ERROR',
    safeMessage: '页面渲染失败',
  };

  it('report 公开入口应显式跳过后台登录态并默认 error 级别', async () => {
    const recordClientEvent = jest.fn().mockResolvedValue('err-1');
    const controller = new ErrorEventReportController({
      recordClientEvent,
    } as unknown as ErrorEventService);

    const result = await controller.report(basePayload as ReportErrorEventDto, {} as Request);

    expect(Reflect.getMetadata('notRequireAuth', ErrorEventReportController.prototype.report)).toBe(true);
    expect(recordClientEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        app: 'admin-web',
        level: 'error',
        errorCode: 'CLIENT_RENDER_ERROR',
        source: 'client-report',
      }),
      expect.any(Object),
    );
    expect(result.data).toEqual({ errorId: 'err-1' });
  });

  it('DTO 接受最小有效错误上报载荷', async () => {
    await expect(validationMessages(basePayload)).resolves.toEqual([]);
  });

  it.each([
    ['未知 app', { ...basePayload, app: 'unknown' }],
    ['空错误码', { ...basePayload, errorCode: '' }],
    ['空安全提示', { ...basePayload, safeMessage: '' }],
    ['负耗时', { ...basePayload, durationMs: -1 }],
    ['额外字段', { ...basePayload, permissions: ['*:*:*'] }],
  ])('DTO 拒绝 %s', async (_label, payload) => {
    await expect(validationMessages(payload)).resolves.not.toEqual([]);
  });
});

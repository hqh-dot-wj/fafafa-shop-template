import 'reflect-metadata';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { ResponseCode } from 'src/common/response/response.interface';
import { ResolutionDiagnosticController } from './resolution-diagnostic.controller';

describe('ResolutionDiagnosticController', () => {
  const diagnosticService = {
    getTraceDiagnostic: jest.fn(),
  };

  let controller: ResolutionDiagnosticController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ResolutionDiagnosticController(diagnosticService as any);
  });

  it('Given 空 traceId, When 查询 trace 诊断, Then 拒绝请求且不加载关联工单', async () => {
    await expect(
      controller.getTraceDiagnostic('   ', undefined, {
        user: { tenantId: 't1' },
      } as any),
    ).rejects.toMatchObject<BusinessException>({
      errorCode: ResponseCode.PARAM_INVALID,
    });

    expect(diagnosticService.getTraceDiagnostic).not.toHaveBeenCalled();
  });

  it('Given traceId 带空白, When 查询 trace 诊断, Then 传入裁剪后的 traceId', async () => {
    diagnosticService.getTraceDiagnostic.mockResolvedValue({
      tenantId: 't1',
      traceId: 'trace-1',
    });

    const result = await controller.getTraceDiagnostic(' trace-1 ', '3', {
      user: { tenantId: 't1' },
    } as any);

    expect(diagnosticService.getTraceDiagnostic).toHaveBeenCalledWith({
      tenantId: 't1',
      traceId: 'trace-1',
      days: 3,
    });
    expect(result.data).toEqual({
      tenantId: 't1',
      traceId: 'trace-1',
    });
  });
});

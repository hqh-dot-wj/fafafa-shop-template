import { AiPlatformPromptController } from './ai-platform-prompt.controller';
import { AiPlatformPromptService } from './ai-platform-prompt.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { Result } from 'src/common/response/result';

describe('AiPlatformPromptController', () => {
  let controller: AiPlatformPromptController;
  let service: Pick<AiPlatformPromptService, 'findAll' | 'findOne' | 'create' | 'update' | 'remove' | 'updateStatus'>;
  let tenantHelper: Pick<TenantHelper, 'getTenantId'>;

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      updateStatus: jest.fn(),
    };
    tenantHelper = { getTenantId: jest.fn().mockReturnValue('000000') };
    controller = new AiPlatformPromptController(service as AiPlatformPromptService, tenantHelper as TenantHelper);
  });

  it('GET list 委托 findAll', async () => {
    const query = { pageNum: 1, pageSize: 10 } as const;
    const expected = Result.page([], 0, 1, 10);
    (service.findAll as jest.Mock).mockResolvedValue(expected);

    const result = await controller.findAll(query);

    expect(result).toBe(expected);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('POST create 使用当前租户', async () => {
    const dto = {
      platformCode: 'X',
      platformName: 'Y',
      systemPrompt: 'z',
      outputSchema: { a: 'string' },
    };
    const expected = Result.ok({ id: '1' });
    (service.create as jest.Mock).mockResolvedValue(expected);

    const result = await controller.create(dto);

    expect(tenantHelper.getTenantId).toHaveBeenCalled();
    expect(service.create).toHaveBeenCalledWith(dto, '000000');
    expect(result).toBe(expected);
  });

  it('PUT :id/status 委托 updateStatus', async () => {
    const expected = Result.ok(null, '状态更新成功');
    (service.updateStatus as jest.Mock).mockResolvedValue(expected);

    const result = await controller.updateStatus('rid', { status: 0 });

    expect(service.updateStatus).toHaveBeenCalledWith('rid', { status: 0 });
    expect(result).toBe(expected);
  });
});

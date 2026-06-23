import { BusinessException } from 'src/common/exceptions';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { AiContentService } from 'src/module/ai-content/ai-content.service';
import { ClientAiContentController } from './client-ai-content.controller';

describe('ClientAiContentController', () => {
  let aiContentService: jest.Mocked<Pick<AiContentService, 'getAvailablePlatforms' | 'generate' | 'getHistory'>>;
  let controller: ClientAiContentController;

  beforeEach(() => {
    aiContentService = {
      getAvailablePlatforms: jest.fn(),
      generate: jest.fn(),
      getHistory: jest.fn(),
    };
    controller = new ClientAiContentController(
      aiContentService as unknown as AiContentService,
      { getTenantId: jest.fn().mockReturnValue('T001') } as unknown as TenantHelper,
    );
  });

  it('getPlatforms 应按当前租户读取启用平台', () => {
    controller.getPlatforms();

    expect(aiContentService.getAvailablePlatforms).toHaveBeenCalledWith('T001');
  });

  it('generate 应使用会员与当前租户调用服务', () => {
    controller.generate('member-1', {
      platformCode: 'XIAOHONGSHU',
      userInput: '新品咖啡',
    });

    expect(aiContentService.generate).toHaveBeenCalledWith('member-1', 'XIAOHONGSHU', '新品咖啡', 'T001');
  });

  it('getHistory 应规范化分页参数', () => {
    controller.getHistory('member-1', '2' as unknown as number, '20' as unknown as number);

    expect(aiContentService.getHistory).toHaveBeenCalledWith('member-1', 2, 20);
  });

  it.each([
    ['pageNum 为 0', 0, 10],
    ['pageNum 为负数', -1, 10],
    ['pageSize 为 0', 1, 0],
    ['pageSize 超出上限', 1, 101],
  ])('getHistory 拒绝非法分页: %s', (_label, pageNum, pageSize) => {
    expect(() => controller.getHistory('member-1', pageNum, pageSize)).toThrow(BusinessException);
    expect(aiContentService.getHistory).not.toHaveBeenCalled();
  });
});

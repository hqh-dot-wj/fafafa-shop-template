import { Test, TestingModule } from '@nestjs/testing';
import { PlayTemplateService } from './template.service';
import { PlayTemplateRepository } from './template.repository';

describe('PlayTemplateService', () => {
  let service: PlayTemplateService;

  const mockRepo = {
    search: jest.fn(),
    findById: jest.fn(),
    findByCode: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlayTemplateService, { provide: PlayTemplateRepository, useValue: mockRepo }],
    }).compile();

    service = module.get<PlayTemplateService>(PlayTemplateService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('Given 用户手填编码和商品字段 When create Then 系统生成模板编码且忽略非模板字段', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(1713513600000);
      jest.spyOn(Math, 'random').mockReturnValue(0.123456);

      mockRepo.findByCode.mockResolvedValue(null);
      mockRepo.create.mockImplementation(async payload => ({
        id: 'tpl_001',
        ...payload,
        createTime: new Date(),
        updateTime: new Date(),
      }));

      const result = await service.create({
        name: '拼课模板',
        code: 'USER_INPUT',
        unitName: '人',
        ruleSchema: { fields: [] },
        uiComponentId: 'group-buy-detail',
        productId: 'prod_001',
        skuId: 'sku_001',
        productName: '测试商品',
      } as any);

      const payload = mockRepo.create.mock.calls[0][0];

      expect(payload).toMatchObject({
        name: '拼课模板',
        unitName: '人',
        ruleSchema: { fields: [] },
        uiComponentId: 'group-buy-detail',
      });
      expect(payload.code).toMatch(/^PT_[A-Z0-9]+_[A-Z0-9]{6}$/);
      expect(payload.code).not.toBe('USER_INPUT');
      expect(payload).not.toHaveProperty('productId');
      expect(payload).not.toHaveProperty('skuId');
      expect(payload).not.toHaveProperty('productName');
      expect(result.data).toMatchObject({
        id: 'tpl_001',
        code: payload.code,
        name: '拼课模板',
      });
    });
  });

  describe('update', () => {
    it('Given 用户传入编码和商品字段 When update Then 仅更新模板层字段', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'tpl_001',
        code: 'PT_EXISTING',
        name: '旧模板',
        unitName: '人',
        ruleSchema: { fields: [] },
        uiComponentId: 'old-detail',
      });
      mockRepo.update.mockImplementation(async (_id, payload) => ({
        id: 'tpl_001',
        code: 'PT_EXISTING',
        ...payload,
        createTime: new Date(),
        updateTime: new Date(),
      }));

      await service.update(
        'tpl_001',
        {
          name: '新模板',
          code: 'USER_INPUT',
          unitName: '组',
          ruleSchema: { fields: [{ key: 'teamSize', label: '成团人数', type: 'number', required: true }] },
          uiComponentId: 'group-buy-detail-v2',
          productId: 'prod_002',
          skuId: 'sku_002',
          productName: '测试商品2',
        } as any,
      );

      expect(mockRepo.findByCode).not.toHaveBeenCalled();
      expect(mockRepo.update).toHaveBeenCalledWith('tpl_001', {
        name: '新模板',
        unitName: '组',
        ruleSchema: { fields: [{ key: 'teamSize', label: '成团人数', type: 'number', required: true }] },
        uiComponentId: 'group-buy-detail-v2',
      });
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { CouponStatus, CouponType, CouponValidityType } from '@prisma/client';
import { BusinessException } from '../../src/common/exceptions/business.exception';
import { PrismaService } from '../../src/prisma/prisma.service';
import { CouponTemplateRepository } from '../../src/module/marketing/coupon/template/template.repository';
import { CouponTemplateService } from '../../src/module/marketing/coupon/template/template.service';

describe('CouponTemplateService', () => {
  let service: CouponTemplateService;

  const mockRepository = {
    create: jest.fn(),
    update: jest.fn(),
    findById: jest.fn(),
    search: jest.fn(),
    hasDistributed: jest.fn(),
    getStatsForTemplates: jest.fn(),
    countDistributed: jest.fn(),
    countUsed: jest.fn(),
  };

  const mockClsService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponTemplateService,
        {
          provide: CouponTemplateRepository,
          useValue: mockRepository,
        },
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: ClsService,
          useValue: mockClsService,
        },
      ],
    }).compile();

    service = module.get<CouponTemplateService>(CouponTemplateService);
    mockClsService.get.mockImplementation((key: string) => (key === 'userId' ? 'admin-001' : undefined));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('create', () => {
    it('应该成功创建满减券模板', async () => {
      const dto = {
        name: '满100减20',
        type: CouponType.DISCOUNT,
        discountAmount: 20,
        minOrderAmount: 100,
        totalStock: 1000,
        limitPerUser: 1,
        validityType: CouponValidityType.RELATIVE,
        validDays: 30,
      };

      mockRepository.create.mockResolvedValue({
        id: 'template-001',
        ...dto,
        tenantId: '',
        createBy: 'admin-001',
        remainingStock: 1000,
        status: CouponStatus.ACTIVE,
      });

      const result = await service.create(dto);

      expect(result.code).toBe(200);
      expect(result.data.id).toBe('template-001');
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: dto.name,
          type: dto.type,
          discountAmount: dto.discountAmount,
          createBy: 'admin-001',
          remainingStock: dto.totalStock,
          status: CouponStatus.ACTIVE,
        }),
      );
    });

    it('应该验证满减券必须有折扣金额', async () => {
      await expect(
        service.create({
          name: '测试券',
          type: CouponType.DISCOUNT,
          discountAmount: 0,
          minOrderAmount: 100,
          totalStock: 1000,
          limitPerUser: 1,
          validityType: CouponValidityType.RELATIVE,
          validDays: 30,
        }),
      ).rejects.toThrow(BusinessException);
    });

    it('应该验证折扣券必须有折扣比例', async () => {
      await expect(
        service.create({
          name: '测试折扣券',
          type: CouponType.PERCENTAGE,
          discountPercent: 0,
          minOrderAmount: 100,
          totalStock: 1000,
          limitPerUser: 1,
          validityType: CouponValidityType.RELATIVE,
          validDays: 30,
        }),
      ).rejects.toThrow(BusinessException);
    });

    it('应该验证固定有效期必须提供开始和结束时间', async () => {
      await expect(
        service.create({
          name: '测试券',
          type: CouponType.DISCOUNT,
          discountAmount: 10,
          minOrderAmount: 50,
          totalStock: 1000,
          limitPerUser: 1,
          validityType: CouponValidityType.FIXED,
        }),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('update', () => {
    it('应该成功更新模板', async () => {
      const templateId = 'template-001';
      const dto = {
        name: '更新后的名称',
      };

      const template = {
        id: templateId,
        name: '原名称',
        type: CouponType.DISCOUNT,
        discountAmount: 20,
        totalStock: 1000,
        validityType: CouponValidityType.RELATIVE,
        validDays: 30,
      };

      mockRepository.findById.mockResolvedValue(template);
      mockRepository.hasDistributed.mockResolvedValue(false);
      mockRepository.update.mockResolvedValue({
        ...template,
        ...dto,
      });

      const result = await service.update(templateId, dto);

      expect(result.code).toBe(200);
      expect(result.data.name).toBe(dto.name);
      expect(mockRepository.update).toHaveBeenCalledWith(templateId, expect.objectContaining(dto));
    });

    it('应该阻止修改已发放的模板关键字段', async () => {
      const templateId = 'template-001';

      mockRepository.findById.mockResolvedValue({
        id: templateId,
        type: CouponType.DISCOUNT,
        discountAmount: 20,
      });
      mockRepository.hasDistributed.mockResolvedValue(true);

      await expect(service.update(templateId, { discountAmount: 30 })).rejects.toThrow(BusinessException);
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('应该成功停用模板', async () => {
      const templateId = 'template-001';

      mockRepository.findById.mockResolvedValue({
        id: templateId,
        status: CouponStatus.ACTIVE,
      });
      mockRepository.update.mockResolvedValue({
        id: templateId,
        status: CouponStatus.INACTIVE,
      });

      const result = await service.deactivate(templateId);

      expect(result.code).toBe(200);
      expect(result.msg).toBe('已停用');
      expect(mockRepository.update).toHaveBeenCalledWith(templateId, { status: CouponStatus.INACTIVE });
    });
  });

  describe('findAll', () => {
    it('应该返回包含统计信息的分页结果', async () => {
      const query = {
        pageNum: 1,
        pageSize: 10,
      };

      mockRepository.search.mockResolvedValue({
        rows: [
          { id: 'template-001', name: '测试券1' },
          { id: 'template-002', name: '测试券2' },
        ],
        total: 2,
      });
      mockRepository.getStatsForTemplates.mockResolvedValue(
        new Map([
          ['template-001', { distributedCount: 5, usedCount: 2, usageRate: 40 }],
          ['template-002', { distributedCount: 0, usedCount: 0, usageRate: 0 }],
        ]),
      );

      const result = await service.findAll(query);

      expect(result.code).toBe(200);
      expect(result.data.rows).toHaveLength(2);
      expect(result.data.rows[0]).toMatchObject({ distributedCount: 5, usedCount: 2, usageRate: 40 });
      expect(result.data.total).toBe(2);
    });

    it('应该支持按类型筛选', async () => {
      const query = {
        type: CouponType.DISCOUNT,
        pageNum: 1,
        pageSize: 10,
      };

      mockRepository.search.mockResolvedValue({ rows: [], total: 0 });
      mockRepository.getStatsForTemplates.mockResolvedValue(new Map());

      await service.findAll(query);

      expect(mockRepository.search).toHaveBeenCalledWith(expect.objectContaining({ type: CouponType.DISCOUNT }));
    });
  });

  describe('findOne', () => {
    it('应该返回模板详情和统计信息', async () => {
      const templateId = 'template-001';

      mockRepository.findById.mockResolvedValue({
        id: templateId,
        totalStock: 1000,
        remainingStock: 800,
      });
      mockRepository.countDistributed.mockResolvedValue(200);
      mockRepository.countUsed.mockResolvedValue(50);

      const result = await service.findOne(templateId);

      expect(result.code).toBe(200);
      expect(result.data).toMatchObject({
        id: templateId,
        totalStock: 1000,
        remainingStock: 800,
        distributedCount: 200,
        usedCount: 50,
        usageRate: 25,
      });
    });
  });
});

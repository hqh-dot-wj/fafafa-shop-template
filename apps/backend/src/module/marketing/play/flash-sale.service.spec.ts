import { Test, TestingModule } from '@nestjs/testing';
import { FlashSaleService } from './flash-sale.service';
import { PlayInstanceService } from '../instance/instance.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { Decimal } from '@prisma/client/runtime/library';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';

describe('FlashSaleService', () => {
  let service: FlashSaleService;

  const mockInstanceService = {};
  const mockPrisma = {
    playInstance: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlashSaleService,
        { provide: PlayInstanceService, useValue: mockInstanceService },
        { provide: PrismaService, useValue: mockPrisma },
        getTenantHelperTestProvider(),
      ],
    }).compile();

    service = module.get<FlashSaleService>(FlashSaleService);
    jest.clearAllMocks();
  });

  describe('calculatePrice', () => {
    it('Given 秒杀价 9.9, 数量 1, When calculatePrice, Then 返回 9.9', async () => {
      const config = { rules: { flashPrice: 9.9 } } as any;
      const result = await service.calculatePrice(config, { quantity: 1 });
      expect(result.toNumber()).toBeCloseTo(9.9);
    });

    it('Given 秒杀价 9.9, 数量 3, When calculatePrice, Then 返回 29.7', async () => {
      const config = { rules: { flashPrice: 9.9 } } as any;
      const result = await service.calculatePrice(config, { quantity: 3 });
      expect(result.toNumber()).toBeCloseTo(29.7);
    });

    it('Given 无 flashPrice, When calculatePrice, Then 返回 0', async () => {
      const config = { rules: {} } as any;
      const result = await service.calculatePrice(config, { quantity: 1 });
      expect(result.toNumber()).toBe(0);
    });

    it('Given 无 quantity, When calculatePrice, Then 默认数量 1', async () => {
      const config = { rules: { flashPrice: 50 } } as any;
      const result = await service.calculatePrice(config, {});
      expect(result.toNumber()).toBe(50);
    });
  });

  describe('validateJoin', () => {
    it('Given 秒杀尚未开始, When validateJoin, Then 抛出异常', async () => {
      const future = new Date(Date.now() + 86400000).toISOString();
      const config = {
        id: 'c1',
        rules: {
          startTime: future,
          endTime: new Date(Date.now() + 172800000).toISOString(),
          limitPerUser: 1,
        },
      } as any;

      await expect(service.validateJoin(config, 'm1', {})).rejects.toThrow(BusinessException);
    });

    it('Given 秒杀已结束, When validateJoin, Then 抛出异常', async () => {
      const config = {
        id: 'c1',
        rules: {
          startTime: '2020-01-01',
          endTime: '2020-12-31',
          limitPerUser: 1,
        },
      } as any;

      await expect(service.validateJoin(config, 'm1', {})).rejects.toThrow(BusinessException);
    });

    it('Given 用户已达限购上限, When validateJoin, Then 抛出限购异常', async () => {
      const now = Date.now();
      const config = {
        id: 'c1',
        rules: {
          startTime: new Date(now - 3600000).toISOString(),
          endTime: new Date(now + 3600000).toISOString(),
          limitPerUser: 1,
        },
      } as any;

      mockPrisma.playInstance.findMany.mockResolvedValue([{ instanceData: { quantity: 1 } }]);

      await expect(service.validateJoin(config, 'm1', { quantity: 1 })).rejects.toThrow(BusinessException);
    });
  });

  describe('getDisplayData', () => {
    it('Given 活动进行中, When getDisplayData, Then 返回 IN_PROGRESS', async () => {
      const now = Date.now();
      const config = {
        id: 'c1',
        rules: {
          flashPrice: 9.9,
          totalStock: 100,
          limitPerUser: 2,
          startTime: new Date(now - 3600000).toISOString(),
          endTime: new Date(now + 3600000).toISOString(),
        },
      } as any;

      // $queryRaw is a tagged template literal function
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([]);

      const result = await service.getDisplayData(config);

      expect(result.status).toBe('IN_PROGRESS');
      expect(result.flashPrice).toBe(9.9);
      expect(result.limitPerUser).toBe(2);
      expect(result.countdown).toBeGreaterThan(0);
    });

    it('Given 活动未开始, When getDisplayData, Then 返回 NOT_STARTED', async () => {
      const future = Date.now() + 86400000;
      const config = {
        id: 'c1',
        rules: {
          flashPrice: 9.9,
          totalStock: 100,
          startTime: new Date(future).toISOString(),
          endTime: new Date(future + 86400000).toISOString(),
        },
      } as any;

      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([]);

      const result = await service.getDisplayData(config);

      expect(result.status).toBe('NOT_STARTED');
    });
  });
});

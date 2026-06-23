import { Test, TestingModule } from '@nestjs/testing';
import { BizOperationLogService } from './biz-operation-log.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { ListOrderBizOperationLogDto } from './dto/list-biz-operation-log.dto';
import { ResponseCode } from 'src/common/response';

describe('BizOperationLogService', () => {
  const mockFindMany = jest.fn();
  const mockCount = jest.fn();
  const mockCreate = jest.fn();

  const mockPrisma = {
    bizOperationLog: {
      findMany: mockFindMany,
      count: mockCount,
      create: mockCreate,
    },
  };

  let service: BizOperationLogService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BizOperationLogService,
        { provide: PrismaService, useValue: mockPrisma },
        getTenantHelperTestProvider(),
      ],
    }).compile();
    service = module.get(BizOperationLogService);
  });

  describe('listForOrder', () => {
    it('应分页查询并将 createTime 格式化为字符串', async () => {
      const created = new Date('2026-04-08T10:00:00.000Z');
      mockFindMany.mockResolvedValue([
        {
          id: 'log1',
          operatorName: 'admin',
          action: 'ORDER_VERIFY',
          targetType: 'ORDER',
          targetId: 'o1',
          detail: null,
          createTime: created,
        },
      ]);
      mockCount.mockResolvedValue(1);

      const query = new ListOrderBizOperationLogDto();
      query.orderId = 'o1';
      query.pageNum = 1;
      query.pageSize = 10;

      const result = await service.listForOrder(query);

      expect(result.code).toBe(ResponseCode.SUCCESS);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { targetType: 'ORDER', targetId: 'o1' },
          orderBy: { createTime: 'desc' },
          skip: 0,
          take: 10,
        }),
      );
      expect(result.data?.rows).toHaveLength(1);
      const row = result.data?.rows[0];
      expect(typeof row?.createTime).toBe('string');
      expect(row?.action).toBe('ORDER_VERIFY');
    });
  });

  describe('append', () => {
    it('租户缺失时应拒绝写入', async () => {
      jest.spyOn(TenantContext, 'getTenantId').mockReturnValue(undefined);

      await expect(
        service.append({
          operatorId: 'u1',
          operatorName: 'a',
          action: 'ORDER_VERIFY',
          targetType: 'ORDER',
          targetId: 'o1',
        }),
      ).rejects.toThrow();

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('应在租户存在时创建记录', async () => {
      jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('t1');
      mockCreate.mockResolvedValue({});

      await service.append({
        operatorId: 'u1',
        operatorName: 'admin',
        action: 'ORDER_VERIFY',
        targetType: 'ORDER',
        targetId: 'o1',
        detail: { remark: '核销' },
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 't1',
          operatorId: 'u1',
          action: 'ORDER_VERIFY',
          targetType: 'ORDER',
          targetId: 'o1',
          detail: expect.stringContaining('remark'),
        }),
      });
    });
  });
});

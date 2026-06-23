import { CouponRefundCompensationStatus } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { CouponRefundCompensationService } from './refund-compensation.service';

describe('CouponRefundCompensationService', () => {
  const prisma = {
    $transaction: jest.fn(async (queries: Array<Promise<unknown>>) => Promise.all(queries)),
    mktCouponRefundCompensation: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: CouponRefundCompensationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CouponRefundCompensationService(prisma as never);
  });

  it('Given 租户上下文, When 查询补偿列表, Then 按租户和状态过滤并分页返回', async () => {
    prisma.mktCouponRefundCompensation.findMany.mockResolvedValue([{ id: 'comp-1', tenantId: 't1' }]);
    prisma.mktCouponRefundCompensation.count.mockResolvedValue(1);

    await TenantContext.run({ tenantId: 't1' }, async () => {
      const result = await service.list({
        status: CouponRefundCompensationStatus.PENDING,
        pageNum: '2',
        pageSize: '20',
      });

      expect(result.data?.total).toBe(1);
    });

    expect(prisma.mktCouponRefundCompensation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 't1', status: CouponRefundCompensationStatus.PENDING },
        skip: 20,
        take: 20,
      }),
    );
    expect(prisma.mktCouponRefundCompensation.count).toHaveBeenCalledWith({
      where: { tenantId: 't1', status: CouponRefundCompensationStatus.PENDING },
    });
  });

  it('Given 非法状态, When 查询补偿列表, Then 抛出业务异常', async () => {
    await expect(service.list({ status: 'DONE' })).rejects.toThrow(BusinessException);
    expect(prisma.mktCouponRefundCompensation.findMany).not.toHaveBeenCalled();
  });

  it('Given 租户上下文和补偿记录, When 标记已处理, Then 先按租户查找再更新处理信息', async () => {
    prisma.mktCouponRefundCompensation.findFirst.mockResolvedValue({ id: 'comp-1', tenantId: 't1' });
    prisma.mktCouponRefundCompensation.update.mockResolvedValue({ id: 'comp-1', status: 'RESOLVED' });

    await TenantContext.run({ tenantId: 't1' }, async () => {
      const result = await service.resolve('comp-1', {
        resolvedBy: 'ops',
        remark: 'issued replacement coupon',
      });

      expect(result.data?.id).toBe('comp-1');
    });

    expect(prisma.mktCouponRefundCompensation.findFirst).toHaveBeenCalledWith({
      where: { id: 'comp-1', tenantId: 't1' },
    });
    expect(prisma.mktCouponRefundCompensation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'comp-1' },
        data: expect.objectContaining({
          status: CouponRefundCompensationStatus.RESOLVED,
          resolvedBy: 'ops',
          resolveRemark: 'issued replacement coupon',
        }),
      }),
    );
  });

  it('Given 补偿记录不存在, When 标记已处理, Then 抛出业务异常', async () => {
    prisma.mktCouponRefundCompensation.findFirst.mockResolvedValue(null);

    await expect(service.resolve('missing')).rejects.toThrow(BusinessException);
    expect(prisma.mktCouponRefundCompensation.update).not.toHaveBeenCalled();
  });
});

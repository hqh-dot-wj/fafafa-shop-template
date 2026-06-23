import { Test, TestingModule } from '@nestjs/testing';
import { StoreDashboardService } from './dashboard.service';
import { StoreOrderRepository } from 'src/module/store/order/store-order.repository';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { WithdrawalStatus } from '@prisma/client';
import { ResponseCode } from 'src/common/response';
import { RedisService } from 'src/module/common/redis/redis.service';
import { CommissionQueryPort } from 'src/module/finance/ports/commission-query.port';
import { WithdrawalQueryPort } from 'src/module/finance/ports/withdrawal-query.port';

type RedisLike = { get: jest.Mock; set: jest.Mock };

describe('StoreDashboardService', () => {
  let service: StoreDashboardService;
  const redisMock: RedisLike = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  };

  const storeOrderRepo = {
    aggregate: jest.fn(),
    sumPaidAmountByDaySince: jest.fn(),
  };

  const commissionQueryPort = {
    aggregate: jest.fn(),
  };

  const withdrawalQueryPort = {
    count: jest.fn(),
    aggregate: jest.fn(),
    findMany: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreDashboardService,
        { provide: StoreOrderRepository, useValue: storeOrderRepo },
        { provide: CommissionQueryPort, useValue: commissionQueryPort },
        { provide: WithdrawalQueryPort, useValue: withdrawalQueryPort },
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile();

    service = module.get(StoreDashboardService);
  });

  it('getDashboard 应汇总提现金额、补齐 30 日收入趋势并返回最近提现', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'isSuperTenant').mockReturnValue(false);

    storeOrderRepo.aggregate
      .mockResolvedValueOnce({ _sum: { payAmount: 100 }, _count: 2 })
      .mockResolvedValueOnce({ _sum: { payAmount: 500 } });
    commissionQueryPort.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 10 } })
      .mockResolvedValueOnce({ _sum: { amount: 20 } });
    withdrawalQueryPort.count.mockResolvedValue(3);
    withdrawalQueryPort.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 50 } })
      .mockResolvedValueOnce({ _sum: { amount: 200 } });
    const trendAnchor = new Date();
    trendAnchor.setHours(0, 0, 0, 0);
    trendAnchor.setDate(trendAnchor.getDate() - 29);
    const ymd = `${trendAnchor.getFullYear()}-${String(trendAnchor.getMonth() + 1).padStart(2, '0')}-${String(trendAnchor.getDate()).padStart(2, '0')}`;
    storeOrderRepo.sumPaidAmountByDaySince.mockResolvedValue([{ day: ymd, amount: 99 }]);
    withdrawalQueryPort.findMany.mockResolvedValue([
      {
        id: 'w1',
        tenantId: 'tenant-1',
        memberId: 'm1',
        amount: { toString: () => '10' },
        method: 'WECHAT_WALLET',
        status: WithdrawalStatus.PENDING,
        realName: '张三',
        auditBy: null,
        auditTime: null,
        auditRemark: null,
        paymentNo: null,
        createTime: new Date('2026-04-08T10:00:00.000Z'),
        member: { nickname: 'u1', mobile: '13800138000', avatar: null },
      },
    ]);

    const result = await service.getDashboard();

    expect(result.code).toBe(ResponseCode.SUCCESS);
    expect(result.data).not.toBeNull();
    const data = result.data as {
      revenueTrend: Array<{ date: string; amount: number }>;
      pendingWithdrawalAmount: number;
      settledWithdrawalAmount: number;
      recentWithdrawals: unknown[];
    };
    expect(data.revenueTrend).toHaveLength(30);
    expect(data.pendingWithdrawalAmount).toBe(50);
    expect(data.settledWithdrawalAmount).toBe(200);
    expect(data.recentWithdrawals).toHaveLength(1);
    expect(data.revenueTrend[0]?.amount).toBe(99);
  });
});

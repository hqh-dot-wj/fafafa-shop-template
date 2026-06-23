import { UserService } from './user.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { BusinessException } from 'src/common/exceptions';
import type { TenantHelper } from 'src/common/tenant/tenant.helper';

describe('UserService', () => {
  let service: UserService;
  let prisma: {
    umsMember: { findUnique: jest.Mock };
    finWallet: { findFirst: jest.Mock };
    mktPointsAccount: { findFirst: jest.Mock };
  };
  let tenantHelper: Pick<TenantHelper, 'readWhereForDelegate'>;

  beforeEach(() => {
    prisma = {
      umsMember: { findUnique: jest.fn() },
      finWallet: { findFirst: jest.fn() },
      mktPointsAccount: { findFirst: jest.fn() },
    };
    tenantHelper = {
      readWhereForDelegate: jest.fn((_delegate: string, where?: object) => ({ ...(where ?? {}) })),
    };
    service = new UserService(prisma as unknown as PrismaService, tenantHelper as unknown as TenantHelper);
  });

  it('Given 用户不存在, When info, Then 抛出异常', async () => {
    prisma.umsMember.findUnique.mockResolvedValue(null);

    await expect(service.info('x')).rejects.toThrow(BusinessException);
    expect(prisma.finWallet.findFirst).not.toHaveBeenCalled();
  });

  it('Given 无钱包无积分账户, When info, Then 余额与积分为 0', async () => {
    prisma.umsMember.findUnique.mockResolvedValue({
      memberId: 'm1',
      tenantId: 'T001',
      levelId: 0,
      nickname: 'n',
      avatar: 'a',
      mobile: '1',
      status: 'NORMAL',
      balance: 999,
      frozenBalance: 888,
      points: 777,
      parentId: null,
      indirectParentId: null,
      referralCode: null,
      upgradedAt: null,
      upgradeOrderId: null,
      createTime: new Date(),
      updateTime: new Date(),
      password: null,
    });
    prisma.finWallet.findFirst.mockResolvedValue(null);
    prisma.mktPointsAccount.findFirst.mockResolvedValue(null);

    const r = await service.info('m1');

    expect(r.balance).toBe(0);
    expect(r.frozenBalance).toBe(0);
    expect(r.points).toBe(0);
    expect(r.levelId).toBe(0);
    expect(prisma.mktPointsAccount.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'T001', memberId: 'm1' },
      select: { availablePoints: true },
    });
  });

  it('Given 有钱包与积分账户, When info, Then 返回主真相字段', async () => {
    prisma.umsMember.findUnique.mockResolvedValue({
      memberId: 'm1',
      tenantId: 'T001',
      levelId: 1,
      nickname: 'n',
      avatar: 'a',
      mobile: '1',
      status: 'NORMAL',
      balance: 1,
      frozenBalance: 2,
      points: 3,
      parentId: null,
      indirectParentId: null,
      referralCode: null,
      upgradedAt: null,
      upgradeOrderId: null,
      createTime: new Date(),
      updateTime: new Date(),
      password: null,
    });
    prisma.finWallet.findFirst.mockResolvedValue({
      balance: 10.5,
      frozen: 2.25,
    });
    prisma.mktPointsAccount.findFirst.mockResolvedValue({ availablePoints: 100 });

    const r = await service.info('m1');

    expect(r.balance).toBe(10.5);
    expect(r.frozenBalance).toBe(2.25);
    expect(r.points).toBe(100);
    expect(r.levelId).toBe(1);
  });
});

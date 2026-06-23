import { CouponDistributionType, CouponType, UserCouponStatus } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserCouponRepository } from './user-coupon.repository';

function createRepository() {
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const $queryRaw = jest.fn();
  const prisma = {
    $queryRaw,
    mktUserCoupon: {
      updateMany,
    },
  } as unknown as PrismaService;
  const cls = {
    get: jest.fn().mockReturnValue(undefined),
  } as unknown as ClsService;

  return {
    repository: new UserCouponRepository(prisma, cls),
    updateMany,
    $queryRaw,
  };
}

describe('UserCouponRepository status transition contracts', () => {
  it('Given coupon unlock, When unlockCoupon, Then only matching LOCKED coupon for the same order can become UNUSED', async () => {
    const { repository, updateMany } = createRepository();

    const result = await repository.unlockCoupon('uc1', 'order1');

    expect(result.count).toBe(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'uc1',
        status: UserCouponStatus.LOCKED,
        orderId: 'order1',
      },
      data: {
        status: UserCouponStatus.UNUSED,
        orderId: null,
      },
    });
  });

  it('Given coupon usage, When useCoupon, Then only matching LOCKED coupon for the same order can become USED', async () => {
    const { repository, updateMany } = createRepository();

    const result = await repository.useCoupon('uc1', 'order1');

    expect(result.count).toBe(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'uc1',
        status: UserCouponStatus.LOCKED,
        orderId: 'order1',
      },
      data: {
        status: UserCouponStatus.USED,
        usedTime: expect.any(Date),
      },
    });
  });

  it('Given coupon already used or locked by another order, When useCoupon affects zero rows, Then caller receives zero', async () => {
    const { repository, updateMany } = createRepository();
    updateMany.mockResolvedValue({ count: 0 });

    await expect(repository.useCoupon('uc1', 'order2')).resolves.toEqual({ count: 0 });
  });

  it('Given coupon refund, When refundCoupon, Then only matching USED coupon for the same order can become UNUSED', async () => {
    const { repository, updateMany } = createRepository();

    const result = await repository.refundCoupon('uc1', 'order1');

    expect(result.count).toBe(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'uc1',
        status: UserCouponStatus.USED,
        orderId: 'order1',
      },
      data: {
        status: UserCouponStatus.UNUSED,
        orderId: null,
        usedTime: null,
      },
    });
  });

  it('Given coupon locked or used by another order, When unlock or refund affects zero rows, Then caller receives zero', async () => {
    const { repository, updateMany } = createRepository();
    updateMany.mockResolvedValue({ count: 0 });

    await expect(repository.unlockCoupon('uc1', 'order2')).resolves.toEqual({ count: 0 });
    await expect(repository.refundCoupon('uc1', 'order2')).resolves.toEqual({ count: 0 });
  });

  it('Given atomic claim SQL returns a row, When tryClaim, Then return created user coupon', async () => {
    const { repository, $queryRaw } = createRepository();
    const row = { id: 'uc1', memberId: 'm1', templateId: 't1', perUserOrd: 3 };
    $queryRaw.mockResolvedValue([row]);

    const result = await repository.tryClaim({
      tenantId: '00000',
      memberId: 'm1',
      templateId: 't1',
      couponName: '满100减20',
      couponType: CouponType.DISCOUNT,
      discountAmount: 20,
      discountPercent: null,
      maxDiscountAmount: null,
      minOrderAmount: 100,
      startTime: new Date('2026-05-01T00:00:00.000Z'),
      endTime: new Date('2026-05-31T00:00:00.000Z'),
      distributionType: CouponDistributionType.ACTIVITY,
      limitPerUser: 3,
    });

    expect(result).toBe(row);
    expect($queryRaw).toHaveBeenCalledTimes(1);
  });

  it('Given atomic claim SQL returns empty, When tryClaim, Then return null for claim limit reached', async () => {
    const { repository, $queryRaw } = createRepository();
    $queryRaw.mockResolvedValue([]);

    await expect(
      repository.tryClaim({
        tenantId: '00000',
        memberId: 'm1',
        templateId: 't1',
        couponName: '满100减20',
        couponType: CouponType.DISCOUNT,
        discountAmount: 20,
        discountPercent: null,
        maxDiscountAmount: null,
        minOrderAmount: 100,
        startTime: new Date('2026-05-01T00:00:00.000Z'),
        endTime: new Date('2026-05-31T00:00:00.000Z'),
        distributionType: CouponDistributionType.ACTIVITY,
        limitPerUser: 1,
      }),
    ).resolves.toBeNull();
  });
});

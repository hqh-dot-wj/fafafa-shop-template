import { BusinessException } from 'src/common/exceptions';
import { CouponDistributionService } from 'src/module/marketing/coupon/distribution/distribution.service';
import { UserCouponRepository } from 'src/module/marketing/coupon/distribution/user-coupon.repository';
import { CouponTemplateRepository } from 'src/module/marketing/coupon/template/template.repository';
import { ClientCouponController } from './client-coupon.controller';

describe('ClientCouponController', () => {
  const distributionService = {
    claimCoupon: jest.fn(),
  };
  const userCouponRepo = {
    findUserCouponsPage: jest.fn(),
    countUserCoupons: jest.fn(),
  };
  const templateRepo = {
    findPage: jest.fn(),
  };

  let controller: ClientCouponController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ClientCouponController(
      distributionService as unknown as CouponDistributionService,
      userCouponRepo as unknown as UserCouponRepository,
      templateRepo as unknown as CouponTemplateRepository,
    );
  });

  it('Given current member, When claimCoupon, Then memberId comes from auth context', async () => {
    distributionService.claimCoupon.mockResolvedValue({ data: { id: 'uc1' } });

    await controller.claimCoupon('template-1', 'member-current');

    expect(distributionService.claimCoupon).toHaveBeenCalledWith('member-current', 'template-1');
  });

  it('Given available coupon query, When page values are numeric strings, Then query active templates with normalized pagination', async () => {
    templateRepo.findPage.mockResolvedValue({
      rows: [{ id: 't1', limitPerUser: 2 }],
      total: 1,
      pageNum: 2,
      pageSize: 20,
    });
    userCouponRepo.countUserCoupons.mockResolvedValue(1);

    const result = await controller.getAvailableCoupons('member-current', '2', '20');

    expect(templateRepo.findPage).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNum: 2,
        pageSize: 20,
        where: expect.objectContaining({
          status: 'ACTIVE',
          remainingStock: { gt: 0 },
        }),
      }),
    );
    expect(userCouponRepo.countUserCoupons).toHaveBeenCalledWith('member-current', 't1');
    expect(result.data?.rows).toHaveLength(1);
    expect(result.data?.rows[0]).toEqual(expect.objectContaining({ claimedCount: 1, claimable: true }));
  });

  it('Given invalid page query, When getAvailableCoupons, Then reject before repository access', async () => {
    await expect(controller.getAvailableCoupons('member-current', '0', '10')).rejects.toThrow(BusinessException);

    expect(templateRepo.findPage).not.toHaveBeenCalled();
  });

  it('Given current member and valid status, When getMyCoupons, Then force member scope and normalize pagination', async () => {
    userCouponRepo.findUserCouponsPage.mockResolvedValue({ rows: [], total: 0 });

    const result = await controller.getMyCoupons('member-current', 'UNUSED', '3', '5');

    expect(userCouponRepo.findUserCouponsPage).toHaveBeenCalledWith('member-current', 'UNUSED', 3, 5);
    expect(result.data?.total).toBe(0);
  });

  it('Given invalid coupon status, When getMyCoupons, Then reject before repository access', async () => {
    await expect(controller.getMyCoupons('member-current', 'INVALID', '1', '10')).rejects.toThrow(BusinessException);

    expect(userCouponRepo.findUserCouponsPage).not.toHaveBeenCalled();
  });
});

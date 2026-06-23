import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CouponStatus, UserCouponStatus } from '@prisma/client';
import { Api } from 'src/common/decorators/api.decorator';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';
import { Member } from 'src/module/client/common/decorators/member.decorator';
import { MemberAuthGuard } from 'src/module/client/common/guards/member-auth.guard';
import { normalizeClientPageQuery } from 'src/module/client/common/utils/pagination';
import { Result } from 'src/common/response/result';
import { FormatDateFields } from 'src/common/utils';
import { CouponDistributionService } from 'src/module/marketing/coupon/distribution/distribution.service';
import { UserCouponRepository } from 'src/module/marketing/coupon/distribution/user-coupon.repository';
import { CouponTemplateRepository } from 'src/module/marketing/coupon/template/template.repository';

/**
 * C端优惠券控制器
 * 提供用户领券、查询可领券、我的优惠券等接口
 * miniapp-client/src/api/marketing-coupon.ts 只消费 my-coupons 的 total 作为入口角标。
 *
 * @tenantScope TenantBound（依赖会员登录态租户隔离）
 */
@ApiTags('C端-优惠券')
@ApiBearerAuth()
@Controller('client/marketing/coupon')
@UseGuards(MemberAuthGuard)
export class ClientCouponController {
  constructor(
    private readonly distributionService: CouponDistributionService,
    private readonly userCouponRepo: UserCouponRepository,
    private readonly templateRepo: CouponTemplateRepository,
  ) {}

  /**
   * 用户领取优惠券
   */
  /**
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Post('claim/:templateId')
  @Api({ summary: '用户领取优惠券' })
  async claimCoupon(@Param('templateId') templateId: string, @Member('memberId') memberId: string) {
    return await this.distributionService.claimCoupon(memberId, templateId);
  }

  /**
   * 查询可领取的优惠券列表
   */
  /**
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('available')
  @Api({ summary: '查询可领取的优惠券列表' })
  async getAvailableCoupons(
    @Member('memberId') memberId: string,
    @Query('pageNum') pageNum?: string | number,
    @Query('pageSize') pageSize?: string | number,
  ) {
    const page = normalizeClientPageQuery(pageNum, pageSize);
    const now = new Date();
    const result = await this.templateRepo.findPage({
      ...page,
      where: {
        status: CouponStatus.ACTIVE,
        remainingStock: { gt: 0 },
        OR: [{ startTime: null }, { startTime: { lte: now } }],
        AND: [{ OR: [{ endTime: null }, { endTime: { gte: now } }] }],
      },
      orderBy: 'createTime',
      order: 'desc',
    });

    const rows = await Promise.all(
      result.rows.map(async (template) => {
        const claimedCount = await this.userCouponRepo.countUserCoupons(memberId, template.id);
        return {
          ...template,
          claimedCount,
          claimable: claimedCount < template.limitPerUser,
        };
      }),
    );

    return Result.page(FormatDateFields(rows), result.total, result.pageNum, result.pageSize);
  }

  /**
   * 查询我的优惠券
   */
  /**
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('my-coupons')
  @Api({ summary: '查询我的优惠券' })
  async getMyCoupons(
    @Member('memberId') memberId: string,
    @Query('status') status?: string,
    @Query('pageNum') pageNum?: string | number,
    @Query('pageSize') pageSize?: string | number,
  ) {
    const page = normalizeClientPageQuery(pageNum, pageSize);
    // status 统一在后端枚举校验，避免客户端角标或列表传入任意字符串绕过券状态边界。
    const normalizedStatus = this.normalizeUserCouponStatus(status);
    const result = await this.userCouponRepo.findUserCouponsPage(
      memberId,
      normalizedStatus,
      page.pageNum,
      page.pageSize,
    );
    return Result.page(FormatDateFields(result.rows), result.total);
  }

  private normalizeUserCouponStatus(status?: string) {
    if (!status) return undefined;
    const values = Object.values(UserCouponStatus) as string[];
    BusinessException.throwIf(!values.includes(status), '优惠券状态无效', ResponseCode.PARAM_INVALID);
    return status as UserCouponStatus;
  }
}

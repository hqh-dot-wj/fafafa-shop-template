import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CouponDistributionService } from './distribution.service';
import { ManualDistributionDto } from './dto/manual-distribution.dto';
import { Api } from 'src/common/decorators/api.decorator';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { Operlog } from 'src/module/admin/common/decorators/operlog.decorator';
import { BusinessType } from 'src/common/constant/business.constant';

/**
 * 优惠券发放控制器
 * 提供优惠券的手动发放和用户领取接口
 * 对应 admin-web service/api/marketing/coupon.ts 的手动发券接口；库存、限领和重复领取校验必须在 service 层收口。
 */
@ApiTags('营销-优惠券发放')
@Controller()
@ApiBearerAuth('Authorization')
export class CouponDistributionController {
  constructor(private readonly service: CouponDistributionService) {}

  /**
   * 手动发放优惠券（管理端）
   * 批量发放优惠券给指定用户
   */
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Post('admin/marketing/coupon/distribute/manual')
  @Api({ summary: '手动发放优惠券' })
  @RequirePermission('marketing:coupon:distribute')
  @Operlog({ businessType: BusinessType.INSERT })
  async distributeManually(@Body() dto: ManualDistributionDto) {
    return await this.service.distributeManually(dto);
  }
}

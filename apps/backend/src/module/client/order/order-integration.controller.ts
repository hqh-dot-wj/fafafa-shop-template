import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { Member } from '../common/decorators/member.decorator';
import { MemberAuthGuard } from '../common/guards/member-auth.guard';
import { Result } from 'src/common/response/result';
import { CalculateDiscountDto } from 'src/module/marketing/integration/dto/calculate-discount.dto';
import { OrderDiscountVo } from 'src/module/marketing/integration/vo/order-discount.vo';
import { OrderMarketingPort } from './ports/order-marketing.port';

/**
 * C端订单优惠计算控制器
 *
 * @tenantScope TenantBound（依赖会员登录态租户隔离）
 */
@ApiTags('C端-订单')
@ApiBearerAuth()
@Controller('client/order')
@UseGuards(MemberAuthGuard)
export class OrderIntegrationController {
  constructor(private readonly marketingPort: OrderMarketingPort) {}

  /**
   * 计算订单优惠
   *
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Post('calculate-discount')
  @Api({ summary: '计算订单优惠' })
  async calculateDiscount(
    @Member('memberId') memberId: string,
    @Body() dto: CalculateDiscountDto,
  ): Promise<Result<OrderDiscountVo>> {
    return this.marketingPort.calculateDiscountPreview(memberId, dto);
  }
}

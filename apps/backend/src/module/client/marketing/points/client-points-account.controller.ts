import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { Member } from 'src/module/client/common/decorators/member.decorator';
import { MemberAuthGuard } from 'src/module/client/common/guards/member-auth.guard';
import { Result } from 'src/common/response/result';
import { PointsAccountService } from 'src/module/marketing/points/account/account.service';
import {
  PointsConsumeAllocationQueryDto,
  PointsFreezeAllocationQueryDto,
  PointsLotQueryDto,
  PointsRefundAllocationQueryDto,
} from 'src/module/marketing/points/account/dto/points-asset-query.dto';
import { TransactionQueryDto } from 'src/module/marketing/points/account/dto/transaction-query.dto';
import { PointsAssetQueryService } from 'src/module/marketing/points/account/points-asset-query.service';
import { PointsBalanceVo } from 'src/module/marketing/points/account/vo/points-account.vo';
import {
  PointsConsumeAllocationVo,
  PointsFreezeAllocationVo,
  PointsLotVo,
  PointsRefundAllocationVo,
} from 'src/module/marketing/points/account/vo/points-asset.vo';

/**
 * C端积分账户控制器
 *
 * @tenantScope TenantBound（依赖会员登录态租户隔离）
 */
@ApiTags('C端-积分账户')
@ApiBearerAuth()
@Controller('client/marketing/points')
@UseGuards(MemberAuthGuard)
export class ClientPointsAccountController {
  constructor(
    private readonly accountService: PointsAccountService,
    private readonly assetQueryService: PointsAssetQueryService,
  ) {}

  /**
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('balance')
  @Api({ summary: '查询积分余额', type: PointsBalanceVo })
  async getBalance(@Member('memberId') memberId: string): Promise<Result<PointsBalanceVo>> {
    return this.accountService.getBalance(memberId);
  }

  /**
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('transactions')
  @Api({ summary: '查询积分明细' })
  async getTransactions(@Member('memberId') memberId: string, @Query() query: TransactionQueryDto) {
    return this.accountService.getTransactions(memberId, query);
  }

  /**
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('expiring')
  @Api({ summary: '查询即将过期的积分' })
  async getExpiringPoints(@Member('memberId') memberId: string, @Query('days') days?: number) {
    return this.accountService.getExpiringPoints(memberId, days);
  }

  /**
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('lots')
  @Api({ summary: '查询我的积分批次', type: PointsLotVo, isArray: true, isPager: true })
  async getLots(@Member('memberId') memberId: string, @Query() query: PointsLotQueryDto) {
    return this.assetQueryService.getLots({ ...query, memberId });
  }

  /**
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('freeze-allocations')
  @Api({ summary: '查询我的积分冻结分摊', type: PointsFreezeAllocationVo, isArray: true, isPager: true })
  async getFreezeAllocations(@Member('memberId') memberId: string, @Query() query: PointsFreezeAllocationQueryDto) {
    return this.assetQueryService.getFreezeAllocations({ ...query, memberId });
  }

  /**
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('consume-allocations')
  @Api({ summary: '查询我的积分消费分摊', type: PointsConsumeAllocationVo, isArray: true, isPager: true })
  async getConsumeAllocations(@Member('memberId') memberId: string, @Query() query: PointsConsumeAllocationQueryDto) {
    return this.assetQueryService.getConsumeAllocations({ ...query, memberId });
  }

  /**
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('refund-allocations')
  @Api({ summary: '查询我的积分退款分摊', type: PointsRefundAllocationVo, isArray: true, isPager: true })
  async getRefundAllocations(@Member('memberId') memberId: string, @Query() query: PointsRefundAllocationQueryDto) {
    return this.assetQueryService.getRefundAllocations({ ...query, memberId });
  }
}

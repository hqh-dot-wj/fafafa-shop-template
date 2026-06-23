import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PointsTransactionType } from '@prisma/client';
import { PointsAccountService } from './account.service';
import { AddPointsDto } from './dto/add-points.dto';
import {
  PointsConsumeAllocationQueryDto,
  PointsDebtQueryDto,
  PointsFreezeAllocationQueryDto,
  PointsLotQueryDto,
  PointsRefundAllocationQueryDto,
} from './dto/points-asset-query.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { PointsAssetQueryService } from './points-asset-query.service';
import {
  PointsConsumeAllocationVo,
  PointsDebtVo,
  PointsFreezeAllocationVo,
  PointsLotVo,
  PointsRefundAllocationVo,
} from './vo/points-asset.vo';
import { Api } from 'src/common/decorators/api.decorator';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { Operlog } from 'src/module/admin/common/decorators/operlog.decorator';
import { BusinessType } from 'src/common/constant/business.constant';

/**
 * 积分账户控制器（管理端）
 *
 * @description 提供管理员积分管理接口
 * 对应 admin-web service/api/marketing/points.ts 的账户、交易和资产批次接口。
 * adjust 是人工调积分高风险写入口；lots/allocations/debts 仅用于解释资产账本，不在 Controller 内做账本修复。
 */
@ApiTags('积分账户管理')
@Controller('admin/marketing/points')
@ApiBearerAuth('Authorization')
export class PointsAccountAdminController {
  constructor(
    private readonly accountService: PointsAccountService,
    private readonly assetQueryService: PointsAssetQueryService,
  ) {}

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Post('adjust')
  @Api({ summary: '调整用户积分' })
  @RequirePermission('marketing:points:adjust')
  @Operlog({ businessType: BusinessType.UPDATE })
  async adjustPoints(@Body() dto: AddPointsDto) {
    return this.accountService.addPoints(dto);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('accounts')
  @Api({ summary: '查询积分账户列表' })
  @RequirePermission('marketing:points:account:list')
  async getAccounts(
    @Query('pageNum') pageNum?: number,
    @Query('pageSize') pageSize?: number,
    @Query('memberId') memberId?: string,
  ) {
    return this.accountService.getAccountsForAdmin({
      pageNum: pageNum ? Number(pageNum) : 1,
      pageSize: pageSize ? Number(pageSize) : 10,
      memberId,
    });
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('transactions')
  @Api({ summary: '查询积分交易记录' })
  @RequirePermission('marketing:points:transaction:list')
  async getTransactions(@Query() query: TransactionQueryDto) {
    return this.accountService.getTransactionsForAdmin({
      memberId: query.memberId,
      type: query.type as PointsTransactionType,
      startTime: query.startTime,
      endTime: query.endTime,
      pageNum: query.pageNum || 1,
      pageSize: query.pageSize || 10,
    });
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('lots')
  @Api({ summary: '查询积分资产批次', type: PointsLotVo, isArray: true, isPager: true })
  @RequirePermission('marketing:points:account:list')
  async getLots(@Query() query: PointsLotQueryDto) {
    return this.assetQueryService.getLots(query);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('freeze-allocations')
  @Api({ summary: '查询积分冻结分摊', type: PointsFreezeAllocationVo, isArray: true, isPager: true })
  @RequirePermission('marketing:points:account:list')
  async getFreezeAllocations(@Query() query: PointsFreezeAllocationQueryDto) {
    return this.assetQueryService.getFreezeAllocations(query);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('consume-allocations')
  @Api({ summary: '查询积分消费分摊', type: PointsConsumeAllocationVo, isArray: true, isPager: true })
  @RequirePermission('marketing:points:account:list')
  async getConsumeAllocations(@Query() query: PointsConsumeAllocationQueryDto) {
    return this.assetQueryService.getConsumeAllocations(query);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('refund-allocations')
  @Api({ summary: '查询积分退款分摊', type: PointsRefundAllocationVo, isArray: true, isPager: true })
  @RequirePermission('marketing:points:account:list')
  async getRefundAllocations(@Query() query: PointsRefundAllocationQueryDto) {
    return this.assetQueryService.getRefundAllocations(query);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('debts')
  @Api({ summary: '查询积分欠账/风险记录', type: PointsDebtVo, isArray: true, isPager: true })
  @RequirePermission('marketing:points:account:list')
  async getDebts(@Query() query: PointsDebtQueryDto) {
    return this.assetQueryService.getDebts(query);
  }
}

import { Controller, Get, Post, Body, Query, Res, Param } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { Operlog } from 'src/module/admin/common/decorators/operlog.decorator';
import { BusinessType } from 'src/common/constant/business.constant';
import { User, UserDto } from 'src/module/admin/system/user/user.decorator';
import { WalletAdminService } from 'src/module/finance/wallet/wallet-admin.service';
import { CommissionAdminService } from 'src/module/finance/commission/commission-admin.service';
import { WithdrawalAdminService } from 'src/module/finance/withdrawal/withdrawal-admin.service';
import { SettlementLogService } from 'src/module/finance/settlement/settlement-log.service';
import { CommissionStatus, WithdrawalStatus } from '@prisma/client';
import {
  ListWalletDto,
  FreezeWalletDto,
  ListCommissionDto,
  ListWithdrawalDto,
  ExportWithdrawalDto,
  ListSettlementLogDto,
} from './dto/admin-finance.dto';

/**
 * Admin端财务管理控制器
 *
 * @description
 * 第三阶段功能：
 * - W-T7: 钱包统计
 * - W-T8: 异常钱包监控
 * - W-T9: 钱包冻结
 * - W-T10: 批量查询
 * - C-T9: 佣金查询
 * - C-T10: 佣金统计
 * - S-T8: 结算日志
 * - WD-T8: 提现统计
 * - WD-T9: 提现导出
 * - WD-T10: 到账通知
 * - WD-T11: 提现详情
 */
@ApiTags('Admin-财务管理')
@Controller('admin/finance')
export class AdminFinanceController {
  constructor(
    private readonly walletAdminService: WalletAdminService,
    private readonly commissionAdminService: CommissionAdminService,
    private readonly withdrawalAdminService: WithdrawalAdminService,
    private readonly settlementLogService: SettlementLogService,
  ) {}

  // ========== 钱包管理 ==========

  /**
   * 获取钱包统计
   *
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('wallet/stats')
  @Api({ summary: '获取钱包统计' })
  @RequirePermission('finance:wallet:stats')
  async getWalletStats() {
    return await this.walletAdminService.getWalletStats();
  }

  /**
   * 查询钱包列表
   *
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('wallet/list')
  @Api({ summary: '查询钱包列表' })
  @RequirePermission('finance:wallet:list')
  async getWalletList(@Query() query: ListWalletDto) {
    return await this.walletAdminService.getWalletList({
      ...query,
      status: query.status as 'NORMAL' | 'FROZEN' | 'DISABLED',
    });
  }

  /**
   * 查询异常钱包
   *
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('wallet/abnormal')
  @Api({ summary: '查询异常钱包' })
  @RequirePermission('finance:wallet:monitor')
  async getAbnormalWallets(@Query('pageNum') pageNum: number = 1, @Query('pageSize') pageSize: number = 20) {
    return await this.walletAdminService.getAbnormalWallets(pageNum, pageSize);
  }

  /**
   * 冻结钱包
   *
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Post('wallet/freeze')
  @Api({ summary: '冻结钱包' })
  @RequirePermission('finance:wallet:freeze')
  @Operlog({ businessType: BusinessType.UPDATE })
  async freezeWallet(@Body() dto: FreezeWalletDto, @User() user: UserDto) {
    return await this.walletAdminService.freezeWallet(dto.walletId, dto.reason, user.userName);
  }

  /**
   * 解冻钱包
   *
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Post('wallet/unfreeze')
  @Api({ summary: '解冻钱包' })
  @RequirePermission('finance:wallet:freeze')
  @Operlog({ businessType: BusinessType.UPDATE })
  async unfreezeWallet(@Body() dto: { walletId: string }, @User() user: UserDto) {
    return await this.walletAdminService.unfreezeWallet(dto.walletId, user.userName);
  }

  /**
   * 批量查询钱包
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Post('wallet/batch')
  @Api({ summary: '批量查询钱包' })
  @RequirePermission('finance:wallet:list')
  async getWalletsByMemberIds(@Body() dto: { memberIds: string[] }) {
    return await this.walletAdminService.getWalletsByMemberIds(dto.memberIds);
  }

  // ========== 佣金管理 ==========

  /**
   * 获取佣金统计
   *
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('commission/stats')
  @Api({ summary: '获取佣金统计' })
  @RequirePermission('finance:commission:stats')
  async getCommissionStats() {
    return await this.commissionAdminService.getCommissionStats();
  }

  /**
   * 查询佣金列表
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('commission/list')
  @Api({ summary: '查询佣金列表' })
  @RequirePermission('finance:commission:list')
  async getCommissionList(@Query() query: ListCommissionDto) {
    return await this.commissionAdminService.getCommissionList({
      ...query,
      status: query.status as CommissionStatus,
    });
  }

  /**
   * 获取佣金详情
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('commission/detail/:id')
  @Api({ summary: '获取佣金详情' })
  @RequirePermission('finance:commission:list')
  async getCommissionDetail(@Param('id') id: string) {
    return await this.commissionAdminService.getCommissionDetail(id);
  }

  /**
   * 获取佣金趋势
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('commission/trend')
  @Api({ summary: '获取佣金趋势' })
  @RequirePermission('finance:commission:stats')
  async getCommissionTrend(@Query('days') days: number = 30) {
    return await this.commissionAdminService.getCommissionTrend(days);
  }

  /**
   * 查询订单项佣金审计
   *
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('commission/audit/:orderId/:orderItemId')
  @Api({ summary: '查询订单项佣金审计' })
  @RequirePermission('finance:commission:list')
  async getCommissionAudit(@Param('orderId') orderId: string, @Param('orderItemId') orderItemId: string) {
    return await this.commissionAdminService.getCommissionAuditByOrderItem(orderId, parseInt(orderItemId, 10));
  }

  // ========== 提现管理 ==========

  /**
   * 获取提现统计
   *
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('withdrawal/stats')
  @Api({ summary: '获取提现统计' })
  @RequirePermission('finance:withdrawal:stats')
  async getWithdrawalStats() {
    return await this.withdrawalAdminService.getWithdrawalStats();
  }

  /**
   * 获取提现趋势
   *
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('withdrawal/trend')
  @Api({ summary: '获取提现趋势' })
  @RequirePermission('finance:withdrawal:stats')
  async getWithdrawalTrend(@Query('days') days: number = 30) {
    return await this.withdrawalAdminService.getWithdrawalTrend(days);
  }

  /**
   * 获取提现详情
   *
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('withdrawal/detail/:id')
  @Api({ summary: '获取提现详情' })
  @RequirePermission('finance:withdrawal:list')
  async getWithdrawalDetail(@Param('id') id: string) {
    return await this.withdrawalAdminService.getWithdrawalDetail(id);
  }

  /**
   * 导出提现数据
   *
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Post('withdrawal/export')
  @Api({
    summary: '导出提现数据',
    produces: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  })
  @RequirePermission('finance:withdrawal:export')
  @Operlog({ businessType: BusinessType.EXPORT })
  async exportWithdrawals(@Res() res: Response, @Body() query: ExportWithdrawalDto) {
    return await this.withdrawalAdminService.exportWithdrawals(res, {
      ...query,
      status: query.status as WithdrawalStatus,
    });
  }

  /**
   * 发送到账通知
   *
   * @sloCategory payment
   * @sloLatency P99 < 200ms
   * @sloAvailability 99.99%
   */
  @Post('withdrawal/notify/:id')
  @Api({ summary: '发送到账通知' })
  @RequirePermission('finance:withdrawal:notify')
  @Operlog({ businessType: BusinessType.OTHER })
  async sendArrivalNotification(@Param('id') id: string) {
    return await this.withdrawalAdminService.sendArrivalNotification(id);
  }

  // ========== 结算日志 ==========

  /**
   * 查询结算日志
   *
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('settlement/logs')
  @Api({ summary: '查询结算日志' })
  @RequirePermission('finance:settlement:logs')
  async getSettlementLogs(@Query() query: ListSettlementLogDto) {
    return await this.settlementLogService.getLogList(query);
  }

  /**
   * 获取结算日志详情
   *
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('settlement/logs/:id')
  @Api({ summary: '获取结算日志详情' })
  @RequirePermission('finance:settlement:logs')
  async getSettlementLogDetail(@Param('id') id: string) {
    return await this.settlementLogService.getLogDetail(id);
  }

  /**
   * 获取结算概览
   *
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('settlement/overview')
  @Api({ summary: '获取结算概览' })
  @RequirePermission('finance:settlement:stats')
  async getSettlementOverview() {
    return await this.settlementLogService.getSettlementOverview();
  }
}

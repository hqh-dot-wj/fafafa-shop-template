import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ClientFinanceService } from './client-finance.service';
import { ApplyWithdrawalDto, ListCommissionDto, ListTransactionDto, ListWithdrawalDto } from './dto/client-finance.dto';
import { Member } from 'src/module/client/common/decorators/member.decorator';
import { MemberAuthGuard } from 'src/module/client/common/guards/member-auth.guard';

@ApiTags('Client-财务中心')
@Controller('client/finance')
@UseGuards(MemberAuthGuard)
export class ClientFinanceController {
  constructor(private readonly clientFinanceService: ClientFinanceService) {}

  /**
   * 获取我的钱包信息
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('wallet')
  @ApiOperation({ summary: '获取我的钱包信息' })
  async getWallet(@Member('tenantId') tenantId: string, @Member('memberId') memberId: string) {
    return await this.clientFinanceService.getWallet(tenantId, memberId);
  }

  /**
   * 申请提现
   *
   * @sloCategory payment
   * @sloLatency P99 < 200ms
   * @sloAvailability 99.99%
   */
  @Post('withdrawal/apply')
  @ApiOperation({ summary: '申请提现' })
  async applyWithdrawal(
    @Body() dto: ApplyWithdrawalDto,
    @Member('tenantId') tenantId: string,
    @Member('memberId') memberId: string,
  ) {
    return await this.clientFinanceService.applyWithdrawal(tenantId, memberId, dto);
  }

  /**
   * 提现记录列表
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('withdrawal/list')
  @ApiOperation({ summary: '提现记录列表' })
  async getWithdrawalList(
    @Query() query: ListWithdrawalDto,
    @Member('tenantId') tenantId: string,
    @Member('memberId') memberId: string,
  ) {
    return await this.clientFinanceService.getWithdrawalList(tenantId, memberId, query);
  }

  /**
   * 佣金记录列表
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('commission/list')
  @ApiOperation({ summary: '佣金记录列表' })
  async getCommissionList(
    @Query() query: ListCommissionDto,
    @Member('tenantId') tenantId: string,
    @Member('memberId') memberId: string,
  ) {
    return await this.clientFinanceService.getCommissionList(tenantId, memberId, query);
  }

  /**
   * 资金流水列表
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('transaction/list')
  @ApiOperation({ summary: '资金流水列表' })
  async getTransactionList(
    @Query() query: ListTransactionDto,
    @Member('tenantId') tenantId: string,
    @Member('memberId') memberId: string,
  ) {
    return await this.clientFinanceService.getTransactionList(tenantId, memberId, query);
  }
}

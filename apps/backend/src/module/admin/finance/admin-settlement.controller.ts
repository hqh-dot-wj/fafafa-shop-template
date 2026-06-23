import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { BusinessType } from 'src/common/constant/business.constant';
import { Operlog } from 'src/module/admin/common/decorators/operlog.decorator';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { User, UserDto } from 'src/module/admin/system/user/user.decorator';
import { AuditSettlementBillDto } from 'src/module/finance/settlement-core/dto/audit-settlement-bill.dto';
import { ExecuteSettlementBillDto } from 'src/module/finance/settlement-core/dto/execute-settlement-bill.dto';
import { ExportReconciliationResultDto } from 'src/module/finance/settlement-core/dto/export-reconciliation-result.dto';
import { HandleReconciliationBufferDto } from 'src/module/finance/settlement-core/dto/handle-reconciliation-buffer.dto';
import { HandleReconciliationIssueDto } from 'src/module/finance/settlement-core/dto/handle-reconciliation-issue.dto';
import { ImportStatementDto } from 'src/module/finance/settlement-core/dto/import-statement.dto';
import { ListPaymentRecordDto } from 'src/module/finance/settlement-core/dto/list-payment-record.dto';
import { ListReconciliationBatchDto } from 'src/module/finance/settlement-core/dto/list-reconciliation-batch.dto';
import { ListReconciliationBufferDto } from 'src/module/finance/settlement-core/dto/list-reconciliation-buffer.dto';
import { ListReconciliationIssueDto } from 'src/module/finance/settlement-core/dto/list-reconciliation-issue.dto';
import { ListReconciliationResultDto } from 'src/module/finance/settlement-core/dto/list-reconciliation-result.dto';
import { ListSettlementBillDto } from 'src/module/finance/settlement-core/dto/list-settlement-bill.dto';
import { ListStatementBatchDto } from 'src/module/finance/settlement-core/dto/list-statement-batch.dto';
import { ListStatementLineDto } from 'src/module/finance/settlement-core/dto/list-statement-line.dto';
import { ReparseStatementBatchDto } from 'src/module/finance/settlement-core/dto/reparse-statement-batch.dto';
import { RerunReconciliationBatchDto } from 'src/module/finance/settlement-core/dto/rerun-reconciliation-batch.dto';
import { RunReconciliationBatchDto } from 'src/module/finance/settlement-core/dto/run-reconciliation-batch.dto';
import { UpdateTenantSettlementProfileDto } from 'src/module/finance/settlement-core/dto/update-tenant-settlement-profile.dto';
import { SettlementCoreService } from 'src/module/finance/settlement-core/settlement-core.service';
import { SettlementReconciliationCenterService } from 'src/module/finance/settlement-core/settlement-reconciliation-center.service';

@ApiTags('Admin-平台清结算')
@Controller('admin/finance/settlement-core')
export class AdminSettlementController {
  constructor(
    private readonly settlementCoreService: SettlementCoreService,
    private readonly settlementReconciliationCenterService: SettlementReconciliationCenterService,
  ) {}

  @Get('tenant-profile/:tenantId')
  @Api({ summary: '获取租户结算配置' })
  @RequirePermission('finance:settlement:profile')
  async getTenantProfile(@Param('tenantId') tenantId: string) {
    return await this.settlementCoreService.getTenantProfile(tenantId);
  }

  @Put('tenant-profile/:tenantId')
  @Api({ summary: '保存租户结算配置' })
  @RequirePermission('finance:settlement:profile:update')
  @Operlog({ businessType: BusinessType.UPDATE })
  async saveTenantProfile(@Param('tenantId') tenantId: string, @Body() dto: UpdateTenantSettlementProfileDto) {
    return await this.settlementCoreService.saveTenantProfile(tenantId, dto);
  }

  @Get('payment/list')
  @Api({ summary: '查询支付单列表' })
  @RequirePermission('finance:settlement:payment:list')
  async listPaymentRecords(@Query() query: ListPaymentRecordDto) {
    return await this.settlementCoreService.listPaymentRecords(query);
  }

  @Get('bill/list')
  @Api({ summary: '查询应结算单列表' })
  @RequirePermission('finance:settlement:bill:list')
  async listSettlementBills(@Query() query: ListSettlementBillDto) {
    return await this.settlementCoreService.listSettlementBills(query);
  }

  @Get('bill/detail/:id')
  @Api({ summary: '获取应结算单详情' })
  @RequirePermission('finance:settlement:bill:detail')
  async getSettlementBillDetail(@Param('id') id: string) {
    return await this.settlementCoreService.getSettlementBillDetail(id);
  }

  @Put('bill/audit')
  @Api({ summary: '审核应结算单' })
  @RequirePermission('finance:settlement:bill:audit')
  @Operlog({ businessType: BusinessType.UPDATE })
  async auditSettlementBill(@Body() dto: AuditSettlementBillDto, @User() user: UserDto) {
    return await this.settlementCoreService.auditSettlementBill(dto, user.userName);
  }

  @Put('bill/execute')
  @Api({ summary: '执行应结算单' })
  @RequirePermission('finance:settlement:bill:execute')
  @Operlog({ businessType: BusinessType.UPDATE })
  async executeSettlementBill(@Body() dto: ExecuteSettlementBillDto, @User() user: UserDto) {
    return await this.settlementCoreService.executeSettlementBill(dto, user.userName);
  }

  @Get('statement/batch/list')
  @Api({ summary: '查询渠道账单批次列表' })
  @RequirePermission('finance:settlement:statement:list')
  async listStatementBatches(@Query() query: ListStatementBatchDto) {
    return await this.settlementReconciliationCenterService.listStatementBatches(query);
  }

  @Get('statement/batch/detail/:id')
  @Api({ summary: '获取渠道账单批次详情' })
  @RequirePermission('finance:settlement:statement:detail')
  async getStatementBatchDetail(@Param('id') id: string) {
    return await this.settlementReconciliationCenterService.getStatementBatchDetail(id);
  }

  @Get('statement/line/list')
  @Api({ summary: '查询渠道账单明细列表' })
  @RequirePermission('finance:settlement:statement:list')
  async listStatementLines(@Query() query: ListStatementLineDto) {
    return await this.settlementReconciliationCenterService.listStatementLines(query);
  }

  @Post('statement/import')
  @Api({ summary: '导入渠道账单并标准化入库' })
  @RequirePermission('finance:settlement:statement:import')
  @Operlog({ businessType: BusinessType.IMPORT })
  async importStatementBatch(@Body() dto: ImportStatementDto, @User() user: UserDto) {
    return await this.settlementReconciliationCenterService.importStatementBatch(dto, user.userName);
  }

  @Put('statement/reparse/:batchId')
  @Api({ summary: '重新解析渠道账单批次' })
  @RequirePermission('finance:settlement:statement:reparse')
  @Operlog({ businessType: BusinessType.UPDATE })
  async reparseStatementBatch(
    @Param('batchId') batchId: string,
    @Body() dto: ReparseStatementBatchDto,
    @User() user: UserDto,
  ) {
    return await this.settlementReconciliationCenterService.reparseStatementBatch(batchId, dto, user.userName);
  }

  @Get('reconcile/batch/list')
  @Api({ summary: '查询对账批次列表' })
  @RequirePermission('finance:settlement:batch:list')
  async listReconciliationBatches(@Query() query: ListReconciliationBatchDto) {
    return await this.settlementReconciliationCenterService.listReconciliationBatches(query);
  }

  @Get('reconcile/batch/detail/:id')
  @Api({ summary: '获取对账批次详情' })
  @RequirePermission('finance:settlement:batch:detail')
  async getReconciliationBatchDetail(@Param('id') id: string) {
    return await this.settlementReconciliationCenterService.getReconciliationBatchDetail(id);
  }

  @Post('reconcile/run')
  @Api({ summary: '发起日级对账批次' })
  @RequirePermission('finance:settlement:batch:run')
  @Operlog({ businessType: BusinessType.UPDATE })
  async runReconciliationBatch(@Body() dto: RunReconciliationBatchDto, @User() user: UserDto) {
    return await this.settlementReconciliationCenterService.runReconciliationBatch(dto, user.userName);
  }

  @Post('reconcile/rerun/:batchId')
  @Api({ summary: '重跑对账批次' })
  @RequirePermission('finance:settlement:batch:rerun')
  @Operlog({ businessType: BusinessType.UPDATE })
  async rerunReconciliationBatch(
    @Param('batchId') batchId: string,
    @Body() dto: RerunReconciliationBatchDto,
    @User() user: UserDto,
  ) {
    return await this.settlementReconciliationCenterService.rerunReconciliationBatch(batchId, dto, user.userName);
  }

  @Get('reconcile/result/list')
  @Api({ summary: '查询对账结果列表' })
  @RequirePermission('finance:settlement:result:list')
  async listReconciliationResults(@Query() query: ListReconciliationResultDto) {
    return await this.settlementReconciliationCenterService.listReconciliationResults(query);
  }

  @Get('reconcile/result/detail/:id')
  @Api({ summary: '获取对账结果详情' })
  @RequirePermission('finance:settlement:result:detail')
  async getReconciliationResultDetail(@Param('id') id: string) {
    return await this.settlementReconciliationCenterService.getReconciliationResultDetail(id);
  }

  @Get('reconcile/result/export')
  @Api({ summary: '导出对账结果' })
  @RequirePermission('finance:settlement:result:export')
  async exportReconciliationResults(@Query() query: ExportReconciliationResultDto) {
    return await this.settlementReconciliationCenterService.exportReconciliationResults(query);
  }

  @Get('reconcile/buffer/list')
  @Api({ summary: '查询对账缓冲池列表' })
  @RequirePermission('finance:settlement:buffer:list')
  async listReconciliationBuffers(@Query() query: ListReconciliationBufferDto) {
    return await this.settlementReconciliationCenterService.listReconciliationBuffers(query);
  }

  @Get('reconcile/buffer/detail/:id')
  @Api({ summary: '获取对账缓冲记录详情' })
  @RequirePermission('finance:settlement:buffer:detail')
  async getReconciliationBufferDetail(@Param('id') id: string) {
    return await this.settlementReconciliationCenterService.getReconciliationBufferDetail(id);
  }

  @Put('reconcile/buffer/recheck')
  @Api({ summary: '立即复核对账缓冲记录' })
  @RequirePermission('finance:settlement:buffer:recheck')
  @Operlog({ businessType: BusinessType.UPDATE })
  async recheckReconciliationBuffer(@Body() dto: HandleReconciliationBufferDto, @User() user: UserDto) {
    return await this.settlementReconciliationCenterService.handleReconciliationBuffer(
      { ...dto, action: 'RECHECK' },
      user.userName,
    );
  }

  @Put('reconcile/buffer/escalate')
  @Api({ summary: '升级对账缓冲记录为正式异常' })
  @RequirePermission('finance:settlement:buffer:escalate')
  @Operlog({ businessType: BusinessType.UPDATE })
  async escalateReconciliationBuffer(@Body() dto: HandleReconciliationBufferDto, @User() user: UserDto) {
    return await this.settlementReconciliationCenterService.handleReconciliationBuffer(
      { ...dto, action: 'ESCALATE' },
      user.userName,
    );
  }

  @Put('reconcile/buffer/ignore')
  @Api({ summary: '忽略对账缓冲记录' })
  @RequirePermission('finance:settlement:buffer:ignore')
  @Operlog({ businessType: BusinessType.UPDATE })
  async ignoreReconciliationBuffer(@Body() dto: HandleReconciliationBufferDto, @User() user: UserDto) {
    return await this.settlementReconciliationCenterService.handleReconciliationBuffer(
      { ...dto, action: 'IGNORE' },
      user.userName,
    );
  }

  @Get('reconciliation/list')
  @Api({ summary: '查询对账异常列表' })
  @RequirePermission('finance:settlement:reconciliation:list')
  async listReconciliationIssues(@Query() query: ListReconciliationIssueDto) {
    return await this.settlementCoreService.listReconciliationIssues(query);
  }

  @Get('reconcile/issue/list')
  @Api({ summary: '查询对账异常列表' })
  @RequirePermission('finance:settlement:issue:list')
  async listReconciliationIssuesV2(@Query() query: ListReconciliationIssueDto) {
    return await this.settlementCoreService.listReconciliationIssues(query);
  }

  @Get('reconcile/issue/detail/:id')
  @Api({ summary: '获取对账异常详情' })
  @RequirePermission('finance:settlement:issue:detail')
  async getReconciliationIssueDetail(@Param('id') id: string) {
    return await this.settlementCoreService.getReconciliationIssueDetail(id);
  }

  @Put('reconciliation/handle')
  @Api({ summary: '处理对账异常' })
  @RequirePermission('finance:settlement:reconciliation:handle')
  @Operlog({ businessType: BusinessType.UPDATE })
  async handleReconciliationIssue(@Body() dto: HandleReconciliationIssueDto, @User() user: UserDto) {
    return await this.settlementCoreService.handleReconciliationIssue(dto, user.userName);
  }

  @Put('reconcile/issue/handle')
  @Api({ summary: '处理对账异常' })
  @RequirePermission('finance:settlement:issue:handle')
  @Operlog({ businessType: BusinessType.UPDATE })
  async handleReconciliationIssueV2(@Body() dto: HandleReconciliationIssueDto, @User() user: UserDto) {
    return await this.settlementCoreService.handleReconciliationIssue(dto, user.userName);
  }
}

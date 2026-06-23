import { Injectable } from '@nestjs/common';
import {
  FinRefundStatus,
  PaymentRecordStatus,
  Prisma,
  ReconciliationBatchStatus,
  ReconciliationBizScope,
  ReconciliationBufferStatus,
  ReconciliationResultStatus,
  ReconciliationStatus,
  SettlementExecutionStatus,
  StatementBatchStatus,
  WithdrawalStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { BusinessException } from 'src/common/exceptions';
import { Result } from 'src/common/response';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { FormatDateFields } from 'src/common/utils';
import { PrismaService } from 'src/prisma/prisma.service';
import { ExportReconciliationResultDto } from './dto/export-reconciliation-result.dto';
import { HandleReconciliationBufferDto } from './dto/handle-reconciliation-buffer.dto';
import { ImportStatementDto } from './dto/import-statement.dto';
import { ListReconciliationBatchDto } from './dto/list-reconciliation-batch.dto';
import { ListReconciliationBufferDto } from './dto/list-reconciliation-buffer.dto';
import { ListReconciliationResultDto } from './dto/list-reconciliation-result.dto';
import { ListStatementBatchDto } from './dto/list-statement-batch.dto';
import { ListStatementLineDto } from './dto/list-statement-line.dto';
import { ReparseStatementBatchDto } from './dto/reparse-statement-batch.dto';
import { RerunReconciliationBatchDto } from './dto/rerun-reconciliation-batch.dto';
import { RunReconciliationBatchDto } from './dto/run-reconciliation-batch.dto';

type MoneyInput = Decimal.Value;

type RefundAmountBreakdown = {
  amountKind: 'REFUND';
  payerRefundAmount: string;
  settlementRefundAmount: string | null;
  refundFeeAmount: string;
  discountRefundAmount: string;
  netAmount: string;
};

type AmountComparison = {
  matched: boolean;
  localAmount: Decimal | null;
  channelAmount: Decimal | null;
  diffAmount: Decimal | null;
  reasonCode: string;
  reasonText: string;
  localAmountBreakdown?: Prisma.InputJsonValue | null;
  channelAmountBreakdown?: Prisma.InputJsonValue | null;
};

type AmountBreakdownInput = {
  amount?: MoneyInput | null;
  payerRefundAmount?: MoneyInput | null;
  settlementRefundAmount?: MoneyInput | null;
  refundFeeAmount?: MoneyInput | null;
  discountRefundAmount?: MoneyInput | null;
  netAmount?: MoneyInput | null;
};

type StatementLineSeed = {
  tenantId?: string | null;
  outBizNo?: string | null;
  transactionId?: string | null;
  externalNo?: string | null;
  amount: MoneyInput;
  amountKind?: string | null;
  payerRefundAmount?: MoneyInput | null;
  settlementRefundAmount?: MoneyInput | null;
  refundFeeAmount?: MoneyInput | null;
  discountRefundAmount?: MoneyInput | null;
  netAmount?: MoneyInput | null;
  status: string;
  tradeTime?: Date | null;
  rawPayload?: Prisma.InputJsonValue | null;
};

type LocalReconciliationRow = {
  tenantId?: string | null;
  localBizId?: string | null;
  outBizNo?: string | null;
  transactionId?: string | null;
  externalNo?: string | null;
  amount: MoneyInput;
  amountKind?: string | null;
  payerRefundAmount?: MoneyInput | null;
  settlementRefundAmount?: MoneyInput | null;
  refundFeeAmount?: MoneyInput | null;
  discountRefundAmount?: MoneyInput | null;
  netAmount?: MoneyInput | null;
  orderId?: string | null;
  billId?: string | null;
  executionId?: string | null;
};

@Injectable()
export class SettlementReconciliationCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  async importStatementBatch(dto: ImportStatementDto, operator: string) {
    const statementDate = this.parseDay(dto.statementDate);
    const rows = await this.loadStatementSource(dto.bizScope, dto.channelType, statementDate);

    const batch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.finChannelStatementBatch.create({
        data: {
          statementDate,
          bizScope: dto.bizScope,
          channelType: dto.channelType,
          sourceType: dto.sourceType ?? 'GENERATED',
          fileName: dto.fileName,
          remark: dto.remark ?? `由 ${operator} 导入标准化账单`,
          rawPayload: {
            operator,
            sourceType: dto.sourceType ?? 'GENERATED',
          },
        },
      });

      if (rows.length > 0) {
        await tx.finChannelStatementLine.createMany({
          data: rows.map((row) =>
            this.buildStatementLineCreateInput(created.id, statementDate, dto.bizScope, dto.channelType, row),
          ),
        });
      }

      return await tx.finChannelStatementBatch.update({
        where: { id: created.id },
        data: {
          status: StatementBatchStatus.NORMALIZED,
          importedCount: rows.length,
          failedCount: 0,
        },
      });
    });

    return Result.ok(batch, '渠道账单已标准化入库');
  }

  async listStatementBatches(query: ListStatementBatchDto) {
    const where: Prisma.FinChannelStatementBatchWhereInput = {
      ...(query.statementDate ? { statementDate: this.parseDay(query.statementDate) } : {}),
      ...(query.bizScope ? { bizScope: query.bizScope } : {}),
      ...(query.channelType ? { channelType: query.channelType } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.finChannelStatementBatch.findMany({
        where,
        orderBy: query.getOrderBy('createTime') ?? { createTime: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.finChannelStatementBatch.count({ where }),
    ]);

    return Result.page(rows, total, query.pageNum, query.pageSize);
  }

  async getStatementBatchDetail(id: string) {
    const batch = await this.prisma.finChannelStatementBatch.findUnique({
      where: { id },
      include: {
        lines: {
          take: 20,
          orderBy: { createTime: 'desc' },
        },
      },
    });

    BusinessException.throwIfNull(batch, '账单批次不存在');
    return Result.ok(batch);
  }

  async reparseStatementBatch(batchId: string, dto: ReparseStatementBatchDto, operator: string) {
    const batch = await this.prisma.finChannelStatementBatch.findUnique({
      where: { id: batchId },
    });
    BusinessException.throwIfNull(batch, '账单批次不存在');

    const rows = await this.loadStatementSource(batch.bizScope, batch.channelType, batch.statementDate);

    const parsedBatch = await this.prisma.$transaction(async (tx) => {
      await tx.finChannelStatementLine.deleteMany({
        where: { batchId: batch.id },
      });

      if (rows.length > 0) {
        await tx.finChannelStatementLine.createMany({
          data: rows.map((row) =>
            this.buildStatementLineCreateInput(batch.id, batch.statementDate, batch.bizScope, batch.channelType, row),
          ),
        });
      }

      return await tx.finChannelStatementBatch.update({
        where: { id: batch.id },
        data: {
          status: StatementBatchStatus.NORMALIZED,
          importedCount: rows.length,
          failedCount: 0,
          remark: dto.remark ?? batch.remark ?? `由 ${operator} 重新解析标准化账单`,
          rawPayload: {
            operator,
            reparsed: true,
            force: dto.force ?? false,
          },
        },
      });
    });

    return Result.ok(parsedBatch, '账单批次已重新解析');
  }

  async listStatementLines(query: ListStatementLineDto) {
    const where: Prisma.FinChannelStatementLineWhereInput = {
      ...(query.batchId ? { batchId: query.batchId } : {}),
      ...(query.bizScope ? { bizScope: query.bizScope } : {}),
      ...(query.channelType ? { channelType: query.channelType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.outBizNo ? { outBizNo: { contains: query.outBizNo } } : {}),
      ...(query.transactionId ? { transactionId: { contains: query.transactionId } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.finChannelStatementLine.findMany({
        where,
        orderBy: query.getOrderBy('tradeTime') ?? { createTime: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.finChannelStatementLine.count({ where }),
    ]);

    return Result.page(rows, total, query.pageNum, query.pageSize);
  }

  async runReconciliationBatch(dto: RunReconciliationBatchDto, operator: string) {
    const batchDate = this.parseDay(dto.batchDate);
    const statementBatch = await this.prisma.finChannelStatementBatch.findFirst({
      where: {
        statementDate: batchDate,
        bizScope: dto.bizScope,
        channelType: dto.channelType,
        status: StatementBatchStatus.NORMALIZED,
      },
      orderBy: { createTime: 'desc' },
    });

    BusinessException.throwIfNull(statementBatch, '未找到可用的标准化账单批次');

    const [statementLines, localRows] = await Promise.all([
      this.prisma.finChannelStatementLine.findMany({
        where: {
          batchId: statementBatch.id,
        },
        orderBy: { createTime: 'asc' },
      }),
      this.loadLocalReconciliationRows(dto.bizScope, dto.channelType, batchDate),
    ]);

    const localRowMap = new Map(
      localRows.map((row) => [
        this.buildMatchKeyForScope(dto.bizScope, row.transactionId, row.outBizNo, row.externalNo),
        row,
      ]),
    );
    const resultSeeds: Prisma.FinReconciliationResultCreateManyInput[] = [];
    let matchedCount = 0;
    let unmatchedCount = 0;
    let bufferedCount = 0;
    let ignoredCount = 0;

    const batch = await this.prisma.$transaction(async (tx) => {
      const createdBatch = await tx.finReconciliationBatch.create({
        data: {
          statementBatchId: statementBatch.id,
          batchDate,
          bizScope: dto.bizScope,
          channelType: dto.channelType,
          status: ReconciliationBatchStatus.RUNNING,
          startedAt: new Date(),
          remark: `由 ${operator} 发起对账`,
        },
      });

      for (const line of statementLines) {
        const channelAmount = this.resolveChannelAmount(dto.bizScope, line);
        const channelAmountValue = this.decimalToNumberOrNull(channelAmount);
        const channelBreakdown = this.buildChannelAmountBreakdown(dto.bizScope, line);

        if (this.shouldIgnoreStatementLine(dto.bizScope, line.status)) {
          ignoredCount += 1;
          resultSeeds.push({
            batchId: createdBatch.id,
            bizScope: dto.bizScope,
            tenantId: line.tenantId ?? null,
            channelType: dto.channelType,
            localBizNo: line.outBizNo ?? null,
            channelBizNo: line.externalNo ?? line.outBizNo ?? null,
            transactionId: line.transactionId ?? null,
            localAmount: null,
            channelAmount: channelAmountValue,
            diffAmount: channelAmountValue,
            channelAmountBreakdown: channelBreakdown,
            status: ReconciliationResultStatus.IGNORED,
            reasonCode: 'REFUND_NOT_SUCCESS_IGNORED',
            reasonText: '退款未成功，未发生可对账资金变动',
          });
          continue;
        }

        const key = this.buildMatchKeyForScope(dto.bizScope, line.transactionId, line.outBizNo, line.externalNo);
        const local = localRowMap.get(key);

        if (local) {
          const comparison = this.compareAmounts(dto.bizScope, local, line);
          const localAmount = this.decimalToNumberOrNull(comparison.localAmount);
          const channelAmount = this.decimalToNumberOrNull(comparison.channelAmount);
          const diffAmount = this.decimalToNumberOrNull(comparison.diffAmount) ?? 0;

          if (comparison.matched) {
            matchedCount += 1;
            resultSeeds.push({
              batchId: createdBatch.id,
              bizScope: dto.bizScope,
              tenantId: local.tenantId ?? line.tenantId ?? null,
              channelType: dto.channelType,
              localBizId: local.localBizId ?? null,
              localBizNo: local.outBizNo ?? null,
              channelBizNo: line.externalNo ?? line.outBizNo ?? null,
              transactionId: line.transactionId ?? local.transactionId ?? null,
              localAmount,
              channelAmount,
              diffAmount: 0,
              localAmountBreakdown: comparison.localAmountBreakdown,
              channelAmountBreakdown: comparison.channelAmountBreakdown,
              status: ReconciliationResultStatus.MATCHED,
              reasonCode: comparison.reasonCode,
              reasonText: comparison.reasonText,
              matchedAt: new Date(),
            });
            continue;
          }

          unmatchedCount += 1;
          const issue = await tx.finReconciliationIssue.create({
            data: {
              tenantId: local.tenantId ?? line.tenantId ?? '000000',
              batchId: createdBatch.id,
              bizScope: dto.bizScope,
              channelType: dto.channelType,
              localBizId: local.localBizId ?? null,
              localBizNo: local.outBizNo ?? null,
              channelBizNo: line.externalNo ?? line.outBizNo ?? null,
              transactionId: line.transactionId ?? local.transactionId ?? null,
              orderId: local.orderId ?? null,
              billId: local.billId ?? null,
              executionId: local.executionId ?? null,
              issueType: comparison.reasonCode,
              status: ReconciliationStatus.WAITING,
              diffAmount,
              issueReason: comparison.reasonText,
            },
          });

          resultSeeds.push({
            batchId: createdBatch.id,
            bizScope: dto.bizScope,
            tenantId: local.tenantId ?? line.tenantId ?? null,
            channelType: dto.channelType,
            localBizId: local.localBizId ?? null,
            localBizNo: local.outBizNo ?? null,
            channelBizNo: line.externalNo ?? line.outBizNo ?? null,
            transactionId: line.transactionId ?? local.transactionId ?? null,
            localAmount,
            channelAmount,
            diffAmount,
            localAmountBreakdown: comparison.localAmountBreakdown,
            channelAmountBreakdown: comparison.channelAmountBreakdown,
            status: ReconciliationResultStatus.UNMATCHED,
            reasonCode: comparison.reasonCode,
            reasonText: comparison.reasonText,
            issueId: issue.id,
          });
          continue;
        }

        if (this.shouldBuffer(line.tradeTime)) {
          bufferedCount += 1;
          const now = new Date();
          const buffer = await tx.finReconciliationBuffer.create({
            data: {
              bizScope: dto.bizScope,
              channelType: dto.channelType,
              tenantId: line.tenantId ?? null,
              localBizNo: line.outBizNo ?? null,
              channelBizNo: line.externalNo ?? line.outBizNo ?? null,
              transactionId: line.transactionId ?? null,
              reasonCode: 'TIME_WINDOW_BUFFERED',
              reasonText: '边缘时间差异，等待次日复核',
              firstSeenAt: now,
              nextCheckAt: new Date(now.getTime() + 30 * 60 * 1000),
              expireAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
              retryCount: 0,
              status: ReconciliationBufferStatus.WAITING,
            },
          });

          resultSeeds.push({
            batchId: createdBatch.id,
            bizScope: dto.bizScope,
            tenantId: line.tenantId ?? null,
            channelType: dto.channelType,
            localBizNo: line.outBizNo ?? null,
            channelBizNo: line.externalNo ?? line.outBizNo ?? null,
            transactionId: line.transactionId ?? null,
            localAmount: null,
            channelAmount: channelAmountValue,
            diffAmount: channelAmountValue,
            channelAmountBreakdown: channelBreakdown,
            status: ReconciliationResultStatus.BUFFERED,
            reasonCode: 'TIME_WINDOW_BUFFERED',
            reasonText: '边缘时间差异，等待次日复核',
            bufferId: buffer.id,
          });
          continue;
        }

        unmatchedCount += 1;
        const issue = await tx.finReconciliationIssue.create({
          data: {
            tenantId: line.tenantId ?? '000000',
            batchId: createdBatch.id,
            bizScope: dto.bizScope,
            channelType: dto.channelType,
            localBizNo: line.outBizNo ?? null,
            channelBizNo: line.externalNo ?? line.outBizNo ?? null,
            transactionId: line.transactionId ?? null,
            issueType: 'LOCAL_MISSING',
            status: ReconciliationStatus.WAITING,
            diffAmount: channelAmountValue,
            issueReason: '渠道有账，我方无本地记录',
          },
        });

        resultSeeds.push({
          batchId: createdBatch.id,
          bizScope: dto.bizScope,
          tenantId: line.tenantId ?? null,
          channelType: dto.channelType,
          localBizNo: line.outBizNo ?? null,
          channelBizNo: line.externalNo ?? line.outBizNo ?? null,
          transactionId: line.transactionId ?? null,
          localAmount: null,
          channelAmount: channelAmountValue,
          diffAmount: channelAmountValue,
          channelAmountBreakdown: channelBreakdown,
          status: ReconciliationResultStatus.UNMATCHED,
          reasonCode: 'LOCAL_MISSING',
          reasonText: '渠道有账，我方无本地记录',
          issueId: issue.id,
        });
      }

      if (resultSeeds.length > 0) {
        await tx.finReconciliationResult.createMany({
          data: resultSeeds,
        });
      } else {
        ignoredCount += 1;
      }

      return await tx.finReconciliationBatch.update({
        where: { id: createdBatch.id },
        data: {
          status: ReconciliationBatchStatus.COMPLETED,
          totalCount: statementLines.length,
          matchedCount,
          unmatchedCount,
          bufferedCount,
          ignoredCount,
          finishedAt: new Date(),
        },
      });
    });

    return Result.ok(batch, '对账批次已完成');
  }

  async rerunReconciliationBatch(batchId: string, dto: RerunReconciliationBatchDto, operator: string) {
    const batch = await this.prisma.finReconciliationBatch.findUnique({
      where: { id: batchId },
    });
    BusinessException.throwIfNull(batch, '对账批次不存在');

    if (dto.clearOldResult) {
      await this.prisma.$transaction([
        this.prisma.finReconciliationResult.deleteMany({
          where: { batchId },
        }),
      ]);
    }

    return this.runReconciliationBatch(
      {
        batchDate: batch.batchDate.toISOString().slice(0, 10),
        bizScope: batch.bizScope,
        channelType: batch.channelType,
        force: true,
      },
      operator,
    );
  }

  async listReconciliationBatches(query: ListReconciliationBatchDto) {
    const where: Prisma.FinReconciliationBatchWhereInput = {
      ...(query.batchDate ? { batchDate: this.parseDay(query.batchDate) } : {}),
      ...(query.bizScope ? { bizScope: query.bizScope } : {}),
      ...(query.channelType ? { channelType: query.channelType } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.finReconciliationBatch.findMany({
        where,
        orderBy: query.getOrderBy('createTime') ?? { createTime: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.finReconciliationBatch.count({ where }),
    ]);

    return Result.page(rows, total, query.pageNum, query.pageSize);
  }

  async getReconciliationBatchDetail(id: string) {
    const batch = await this.prisma.finReconciliationBatch.findUnique({
      where: { id },
      include: {
        statementBatch: true,
      },
    });
    BusinessException.throwIfNull(batch, '对账批次不存在');
    return Result.ok(batch);
  }

  async listReconciliationResults(query: ListReconciliationResultDto | ExportReconciliationResultDto) {
    const scopedWhere = this.buildReconciliationResultWhere(query);

    const [rows, total] = await Promise.all([
      this.prisma.finReconciliationResult.findMany({
        where: scopedWhere,
        orderBy: query.getOrderBy('createTime') ?? { createTime: 'desc' },
        skip: 'skip' in query ? query.skip : undefined,
        take: 'take' in query ? query.take : undefined,
      }),
      this.prisma.finReconciliationResult.count({ where: scopedWhere }),
    ]);

    return Result.page(
      rows,
      total,
      (query as ListReconciliationResultDto).pageNum,
      (query as ListReconciliationResultDto).pageSize,
    );
  }

  async exportReconciliationResults(query: ExportReconciliationResultDto) {
    const where = this.buildReconciliationResultWhere(query);
    const rows = await this.prisma.finReconciliationResult.findMany({
      where,
      orderBy: query.getOrderBy('createTime') ?? { createTime: 'desc' },
    });

    return Result.ok(rows, '对账结果已导出');
  }

  async getReconciliationResultDetail(id: string) {
    const result = await this.prisma.finReconciliationResult.findFirst({
      where: this.tenantHelper.readWhereForDelegate('finReconciliationResult', {
        id,
      } as object) as Prisma.FinReconciliationResultWhereInput,
    });
    BusinessException.throwIfNull(result, '对账结果不存在');
    return Result.ok(result);
  }

  async listReconciliationBuffers(query: ListReconciliationBufferDto) {
    const where: Prisma.FinReconciliationBufferWhereInput = {
      ...(query.bizScope ? { bizScope: query.bizScope } : {}),
      ...(query.channelType ? { channelType: query.channelType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.reasonCode ? { reasonCode: query.reasonCode } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
    };

    const scopedWhere = this.tenantHelper.readWhereForDelegate(
      'finReconciliationBuffer',
      where as object,
    ) as Prisma.FinReconciliationBufferWhereInput;

    const [rows, total] = await Promise.all([
      this.prisma.finReconciliationBuffer.findMany({
        where: scopedWhere,
        orderBy: query.getOrderBy('createTime') ?? { createTime: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.finReconciliationBuffer.count({ where: scopedWhere }),
    ]);

    return Result.page(rows, total, query.pageNum, query.pageSize);
  }

  async getReconciliationBufferDetail(id: string) {
    const buffer = await this.prisma.finReconciliationBuffer.findFirst({
      where: this.tenantHelper.readWhereForDelegate('finReconciliationBuffer', {
        id,
      } as object) as Prisma.FinReconciliationBufferWhereInput,
    });
    BusinessException.throwIfNull(buffer, '缓冲记录不存在');
    return Result.ok(buffer);
  }

  async handleReconciliationBuffer(dto: HandleReconciliationBufferDto, operator: string) {
    const buffer = await this.prisma.finReconciliationBuffer.findUnique({
      where: { id: dto.bufferId },
    });
    BusinessException.throwIfNull(buffer, '缓冲记录不存在');

    if (dto.action === 'RECHECK') {
      const record = await this.prisma.finReconciliationBuffer.update({
        where: { id: buffer.id },
        data: {
          status: ReconciliationBufferStatus.RECHECKING,
          retryCount: buffer.retryCount + 1,
          nextCheckAt: new Date(Date.now() + 30 * 60 * 1000),
          reasonText: dto.remark ?? '已提交立即复核',
        },
      });

      return Result.ok(record, '缓冲记录已进入复核');
    }

    if (dto.action === 'IGNORE') {
      const record = await this.prisma.$transaction(async (tx) => {
        await tx.finReconciliationResult.updateMany({
          where: { bufferId: buffer.id },
          data: {
            status: ReconciliationResultStatus.IGNORED,
            reasonText: dto.remark ?? '人工忽略缓冲记录',
          },
        });

        return await tx.finReconciliationBuffer.update({
          where: { id: buffer.id },
          data: {
            status: ReconciliationBufferStatus.IGNORED,
            retryCount: buffer.retryCount + 1,
            reasonText: dto.remark ?? '人工忽略缓冲记录',
          },
        });
      });

      return Result.ok(record, '缓冲记录已忽略');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const issue = await tx.finReconciliationIssue.create({
        data: {
          tenantId: buffer.tenantId ?? '000000',
          bizScope: buffer.bizScope,
          channelType: buffer.channelType,
          localBizId: buffer.localBizId,
          localBizNo: buffer.localBizNo,
          channelBizNo: buffer.channelBizNo,
          transactionId: buffer.transactionId,
          issueType: buffer.reasonCode,
          status: ReconciliationStatus.WAITING,
          issueReason: dto.remark ?? '超过缓冲时限，升级异常',
        },
      });

      await tx.finReconciliationResult.updateMany({
        where: { bufferId: buffer.id },
        data: {
          status: ReconciliationResultStatus.UNMATCHED,
          issueId: issue.id,
          reasonText: dto.remark ?? '超过缓冲时限，升级异常',
        },
      });

      const updated = await tx.finReconciliationBuffer.update({
        where: { id: buffer.id },
        data: {
          status: ReconciliationBufferStatus.EXPIRED,
          retryCount: buffer.retryCount + 1,
          reasonText: dto.remark ?? '超过缓冲时限，升级异常',
        },
      });

      return { issue, updated };
    });

    return Result.ok(
      FormatDateFields({
        bufferId: result.updated.id,
        issueId: result.issue.id,
        status: result.updated.status,
      }),
      '缓冲记录已升级为正式异常',
    );
  }

  private async loadStatementSource(
    scope: ReconciliationBizScope,
    channelType: string,
    statementDate: Date,
  ): Promise<StatementLineSeed[]> {
    const range = this.buildDayRange(statementDate);

    if (scope === ReconciliationBizScope.PAYMENT) {
      const records = await this.prisma.payOrderRecord.findMany({
        where: {
          channelType,
          status: PaymentRecordStatus.SUCCESS,
          OR: [{ payTime: range }, { createTime: range }],
        },
      });

      return records.map((record) => ({
        tenantId: record.tenantId,
        outBizNo: record.orderSn,
        transactionId: record.transactionId,
        amount: Number(record.payAmount),
        status: record.status,
        tradeTime: record.payTime ?? record.createTime,
        rawPayload: record.rawPayload,
      }));
    }

    if (scope === ReconciliationBizScope.REFUND) {
      const records = await this.prisma.finRefund.findMany({
        where: {
          channelType: this.buildRefundChannelWhere(channelType),
          status: {
            in: [
              FinRefundStatus.PROCESSING,
              FinRefundStatus.SUCCESS,
              FinRefundStatus.FAILED,
              FinRefundStatus.CLOSED,
              FinRefundStatus.ABNORMAL,
            ],
          },
          OR: [{ successTime: range }, { updateTime: range }, { createTime: range }],
        },
      });

      return records.map((record) => this.toRefundStatementLine(record));
    }

    if (scope === ReconciliationBizScope.SETTLEMENT) {
      const records = await this.prisma.finSettlementExecution.findMany({
        where: {
          channelType: channelType as any,
          status: {
            in: [
              SettlementExecutionStatus.PROCESSING,
              SettlementExecutionStatus.SUCCESS,
              SettlementExecutionStatus.FAILED,
            ],
          },
          OR: [{ createTime: range }, { updateTime: range }],
        },
        include: {
          bill: {
            select: {
              tenantId: true,
              storeAmount: true,
              billNo: true,
              orderId: true,
            },
          },
        },
      });

      return records.map((record) => ({
        tenantId: record.tenantId,
        outBizNo: record.executeNo,
        externalNo: record.externalNo,
        amount: Number(record.bill.storeAmount),
        status: record.status,
        tradeTime: record.updateTime,
        rawPayload: record.responsePayload as Prisma.InputJsonValue | null,
      }));
    }

    const records = await this.prisma.finWithdrawal.findMany({
      where: {
        method: channelType,
        status: {
          in: [WithdrawalStatus.PROCESSING, WithdrawalStatus.APPROVED, WithdrawalStatus.FAILED],
        },
        createTime: range,
      },
    });

    return records.map((record) => ({
      tenantId: record.tenantId,
      outBizNo: record.id,
      externalNo: record.paymentNo,
      amount: Number(record.actualAmount ?? record.amount),
      status: record.status,
      tradeTime: record.auditTime ?? record.createTime,
    }));
  }

  private async loadLocalReconciliationRows(
    scope: ReconciliationBizScope,
    channelType: string,
    batchDate: Date,
  ): Promise<LocalReconciliationRow[]> {
    const range = this.buildDayRange(batchDate);

    if (scope === ReconciliationBizScope.PAYMENT) {
      const records = await this.prisma.payOrderRecord.findMany({
        where: {
          channelType,
          status: PaymentRecordStatus.SUCCESS,
          OR: [{ payTime: range }, { createTime: range }],
        },
      });

      return records.map((record) => ({
        tenantId: record.tenantId,
        localBizId: record.id,
        outBizNo: record.orderSn,
        transactionId: record.transactionId,
        amount: Number(record.payAmount),
        orderId: record.orderId,
      }));
    }

    if (scope === ReconciliationBizScope.REFUND) {
      const records = await this.prisma.finRefund.findMany({
        where: {
          channelType: this.buildRefundChannelWhere(channelType),
          status: FinRefundStatus.SUCCESS,
          OR: [{ successTime: range }, { updateTime: range }],
        },
      });

      return records.map((record) => this.toRefundLocalRow(record));
    }

    if (scope === ReconciliationBizScope.SETTLEMENT) {
      const records = await this.prisma.finSettlementExecution.findMany({
        where: {
          channelType: channelType as any,
          OR: [{ createTime: range }, { updateTime: range }],
        },
        include: {
          bill: {
            select: {
              id: true,
              tenantId: true,
              storeAmount: true,
              orderId: true,
            },
          },
        },
      });

      return records.map((record) => ({
        tenantId: record.tenantId,
        localBizId: record.id,
        outBizNo: record.executeNo,
        transactionId: record.externalNo ?? record.executeNo,
        amount: Number(record.bill.storeAmount),
        billId: record.billId,
        executionId: record.id,
        orderId: record.bill.orderId,
      }));
    }

    const records = await this.prisma.finWithdrawal.findMany({
      where: {
        method: channelType,
        createTime: range,
      },
    });

    return records.map((record) => ({
      tenantId: record.tenantId,
      localBizId: record.id,
      outBizNo: record.id,
      transactionId: record.paymentNo,
      amount: Number(record.actualAmount ?? record.amount),
    }));
  }

  private buildMatchKeyForScope(
    scope: ReconciliationBizScope,
    transactionId?: string | null,
    outBizNo?: string | null,
    externalNo?: string | null,
  ) {
    if (scope === ReconciliationBizScope.REFUND) {
      return outBizNo || transactionId || externalNo || `UNKNOWN:${Math.random()}`;
    }

    return transactionId || outBizNo || externalNo || `UNKNOWN:${Math.random()}`;
  }

  private resolveChannelAmount(scope: ReconciliationBizScope, line: AmountBreakdownInput): Decimal {
    if (scope === ReconciliationBizScope.REFUND) {
      return this.toMoney(this.buildRefundAmountBreakdown(line).payerRefundAmount);
    }
    return this.toMoney(line.amount ?? 0);
  }

  private compareAmounts(
    scope: ReconciliationBizScope,
    local: LocalReconciliationRow,
    line: AmountBreakdownInput,
  ): AmountComparison {
    if (scope === ReconciliationBizScope.REFUND) {
      const localBreakdown = this.buildRefundAmountBreakdown(local);
      const channelBreakdown = this.buildRefundAmountBreakdown(line);
      const localAmount = this.toMoney(localBreakdown.payerRefundAmount);
      const channelAmount = this.toMoney(channelBreakdown.payerRefundAmount);
      const diffAmount = this.toMoney(channelBreakdown.netAmount)
        .sub(this.toMoney(localBreakdown.netAmount))
        .toDecimalPlaces(2);

      if (!this.findRefundBreakdownMismatch(localBreakdown, channelBreakdown)) {
        return {
          matched: true,
          localAmount,
          channelAmount,
          diffAmount: new Decimal(0),
          reasonCode: 'MATCHED',
          reasonText: `退款金额口径匹配：用户退款 ${localBreakdown.payerRefundAmount}，手续费 ${localBreakdown.refundFeeAmount}，净额 ${localBreakdown.netAmount}`,
          localAmountBreakdown: localBreakdown as Prisma.InputJsonValue,
          channelAmountBreakdown: channelBreakdown as Prisma.InputJsonValue,
        };
      }

      return {
        matched: false,
        localAmount,
        channelAmount,
        diffAmount,
        reasonCode: 'REFUND_AMOUNT_BREAKDOWN_MISMATCH',
        reasonText: this.buildRefundMismatchReason(localBreakdown, channelBreakdown),
        localAmountBreakdown: localBreakdown as Prisma.InputJsonValue,
        channelAmountBreakdown: channelBreakdown as Prisma.InputJsonValue,
      };
    }

    const localAmount = this.toMoney(local.amount);
    const channelAmount = this.toMoney(line.amount ?? 0);
    const diffAmount = channelAmount.sub(localAmount).toDecimalPlaces(2);
    const matched = diffAmount.equals(0);

    return {
      matched,
      localAmount,
      channelAmount,
      diffAmount,
      reasonCode: matched ? 'MATCHED' : 'AMOUNT_MISMATCH',
      reasonText: matched ? '金额与状态匹配' : '我方金额与渠道金额不一致',
    };
  }

  private decimalToNumberOrNull(value: Decimal | null | undefined): number | null {
    return value == null ? null : this.decimalToNumber(value);
  }

  private shouldIgnoreStatementLine(scope: ReconciliationBizScope, status: string): boolean {
    return scope === ReconciliationBizScope.REFUND && status !== FinRefundStatus.SUCCESS;
  }

  private buildLocalAmountBreakdown(
    scope: ReconciliationBizScope,
    row: LocalReconciliationRow,
  ): Prisma.InputJsonValue | undefined {
    if (scope !== ReconciliationBizScope.REFUND) return undefined;
    return this.buildRefundAmountBreakdown(row) as Prisma.InputJsonValue;
  }

  private buildChannelAmountBreakdown(
    scope: ReconciliationBizScope,
    line: AmountBreakdownInput,
  ): Prisma.InputJsonValue | undefined {
    if (scope !== ReconciliationBizScope.REFUND) return undefined;
    return this.buildRefundAmountBreakdown(line) as Prisma.InputJsonValue;
  }

  private buildRefundAmountBreakdown(input: AmountBreakdownInput): RefundAmountBreakdown {
    const payerRefundAmount = this.toMoney(input.payerRefundAmount ?? input.amount ?? 0);
    const settlementRefundAmount =
      input.settlementRefundAmount == null ? null : this.toMoney(input.settlementRefundAmount);
    const refundFeeAmount = this.toMoney(input.refundFeeAmount ?? 0);
    const discountRefundAmount = this.toMoney(input.discountRefundAmount ?? 0);
    const netAmount =
      input.netAmount == null
        ? (settlementRefundAmount ?? payerRefundAmount.sub(refundFeeAmount))
        : this.toMoney(input.netAmount);

    return {
      amountKind: 'REFUND',
      payerRefundAmount: this.formatMoney(payerRefundAmount),
      settlementRefundAmount: settlementRefundAmount == null ? null : this.formatMoney(settlementRefundAmount),
      refundFeeAmount: this.formatMoney(refundFeeAmount),
      discountRefundAmount: this.formatMoney(discountRefundAmount),
      netAmount: this.formatMoney(netAmount),
    };
  }

  private findRefundBreakdownMismatch(local: RefundAmountBreakdown, channel: RefundAmountBreakdown) {
    const fields: Array<keyof Omit<RefundAmountBreakdown, 'amountKind'>> = [
      'payerRefundAmount',
      'settlementRefundAmount',
      'refundFeeAmount',
      'discountRefundAmount',
      'netAmount',
    ];

    return fields.find((field) => !this.isSameNullableMoney(local[field], channel[field]));
  }

  private buildRefundMismatchReason(local: RefundAmountBreakdown, channel: RefundAmountBreakdown) {
    return [
      '退款金额口径不一致',
      `用户退款 本地 ${local.payerRefundAmount} / 渠道 ${channel.payerRefundAmount}`,
      `结算退款 本地 ${this.formatNullableMoney(local.settlementRefundAmount)} / 渠道 ${this.formatNullableMoney(channel.settlementRefundAmount)}`,
      `手续费 本地 ${local.refundFeeAmount} / 渠道 ${channel.refundFeeAmount}`,
      `优惠退款 本地 ${local.discountRefundAmount} / 渠道 ${channel.discountRefundAmount}`,
      `净额 本地 ${local.netAmount} / 渠道 ${channel.netAmount}`,
    ].join('；');
  }

  private buildRefundChannelWhere(channelType: string): Prisma.StringFilter | string {
    if (channelType === 'WECHAT_PAY') {
      return { in: ['WECHAT_PAY', 'WECHAT'] };
    }

    if (channelType === 'WECHAT') {
      return { in: ['WECHAT', 'WECHAT_PAY'] };
    }

    return channelType;
  }

  private toRefundStatementLine(record: {
    tenantId?: string | null;
    refundSn: string;
    refundId?: string | null;
    requestedAmount: MoneyInput;
    payerRefundAmount?: MoneyInput | null;
    settlementRefundAmount?: MoneyInput | null;
    refundFeeAmount?: MoneyInput | null;
    discountRefundAmount?: MoneyInput | null;
    status: string;
    successTime?: Date | null;
    updateTime?: Date | null;
    createTime?: Date | null;
    rawPayload?: unknown;
  }): StatementLineSeed {
    const breakdown = this.buildRefundAmountBreakdown({
      amount: record.requestedAmount,
      payerRefundAmount: record.payerRefundAmount ?? record.requestedAmount,
      settlementRefundAmount: record.settlementRefundAmount,
      refundFeeAmount: record.refundFeeAmount,
      discountRefundAmount: record.discountRefundAmount,
    });

    return {
      tenantId: record.tenantId ?? null,
      outBizNo: record.refundSn,
      transactionId: record.refundId ?? null,
      externalNo: record.refundId ?? record.refundSn,
      amount: breakdown.payerRefundAmount,
      amountKind: 'REFUND',
      payerRefundAmount: breakdown.payerRefundAmount,
      settlementRefundAmount: breakdown.settlementRefundAmount,
      refundFeeAmount: breakdown.refundFeeAmount,
      discountRefundAmount: breakdown.discountRefundAmount,
      netAmount: breakdown.netAmount,
      status: record.status,
      tradeTime: record.successTime ?? record.updateTime ?? record.createTime ?? null,
      rawPayload: record.rawPayload == null ? null : (record.rawPayload as Prisma.InputJsonValue),
    };
  }

  private toRefundLocalRow(record: {
    tenantId?: string | null;
    id: string;
    orderId?: string | null;
    refundSn: string;
    refundId?: string | null;
    requestedAmount: MoneyInput;
    payerRefundAmount?: MoneyInput | null;
    settlementRefundAmount?: MoneyInput | null;
    refundFeeAmount?: MoneyInput | null;
    discountRefundAmount?: MoneyInput | null;
  }): LocalReconciliationRow {
    const breakdown = this.buildRefundAmountBreakdown({
      amount: record.requestedAmount,
      payerRefundAmount: record.payerRefundAmount ?? record.requestedAmount,
      settlementRefundAmount: record.settlementRefundAmount,
      refundFeeAmount: record.refundFeeAmount,
      discountRefundAmount: record.discountRefundAmount,
    });

    return {
      tenantId: record.tenantId ?? null,
      localBizId: record.id,
      outBizNo: record.refundSn,
      transactionId: record.refundId ?? null,
      externalNo: record.refundId ?? record.refundSn,
      amount: breakdown.payerRefundAmount,
      amountKind: 'REFUND',
      payerRefundAmount: breakdown.payerRefundAmount,
      settlementRefundAmount: breakdown.settlementRefundAmount,
      refundFeeAmount: breakdown.refundFeeAmount,
      discountRefundAmount: breakdown.discountRefundAmount,
      netAmount: breakdown.netAmount,
      orderId: record.orderId ?? null,
    };
  }

  private buildStatementLineCreateInput(
    batchId: string,
    statementDate: Date,
    bizScope: ReconciliationBizScope,
    channelType: string,
    row: StatementLineSeed,
  ): Prisma.FinChannelStatementLineCreateManyInput {
    return {
      batchId,
      statementDate,
      tenantId: row.tenantId ?? null,
      bizScope,
      channelType,
      transactionId: row.transactionId ?? null,
      externalNo: row.externalNo ?? null,
      outBizNo: row.outBizNo ?? null,
      amount: this.toMoney(row.amount),
      amountKind: row.amountKind ?? bizScope,
      payerRefundAmount: this.toNullableMoney(row.payerRefundAmount),
      settlementRefundAmount: this.toNullableMoney(row.settlementRefundAmount),
      refundFeeAmount: this.toNullableMoney(row.refundFeeAmount),
      discountRefundAmount: this.toNullableMoney(row.discountRefundAmount),
      netAmount: this.toNullableMoney(row.netAmount),
      status: row.status,
      tradeTime: row.tradeTime ?? null,
      rawPayload: row.rawPayload ?? null,
    };
  }

  private toMoney(value: MoneyInput): Decimal {
    return new Decimal(value).toDecimalPlaces(2);
  }

  private toNullableMoney(value?: MoneyInput | null): Decimal | null {
    return value == null ? null : this.toMoney(value);
  }

  private decimalToNumber(value: Decimal): number {
    const amount = value.toDecimalPlaces(2);
    return amount.isZero() ? 0 : amount.toNumber();
  }

  private formatMoney(value: Decimal): string {
    return value.toDecimalPlaces(2).toFixed(2);
  }

  private formatNullableMoney(value: string | null): string {
    return value ?? '-';
  }

  private isSameNullableMoney(left: string | null, right: string | null): boolean {
    if (left == null || right == null) {
      return left == null && right == null;
    }

    return this.toMoney(left).equals(this.toMoney(right));
  }

  private buildReconciliationResultWhere(query: ListReconciliationResultDto | ExportReconciliationResultDto) {
    const where: Prisma.FinReconciliationResultWhereInput = {
      ...(query.batchId ? { batchId: query.batchId } : {}),
      ...(query.bizScope ? { bizScope: query.bizScope } : {}),
      ...(query.channelType ? { channelType: query.channelType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.reasonCode ? { reasonCode: query.reasonCode } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.localBizNo ? { localBizNo: { contains: query.localBizNo } } : {}),
      ...(query.channelBizNo ? { channelBizNo: { contains: query.channelBizNo } } : {}),
    };

    return this.tenantHelper.readWhereForDelegate(
      'finReconciliationResult',
      where as object,
    ) as Prisma.FinReconciliationResultWhereInput;
  }

  private buildDayRange(day: Date) {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 999);
    return {
      gte: start,
      lte: end,
    };
  }

  private parseDay(dateText: string) {
    return new Date(`${dateText}T00:00:00.000Z`);
  }

  private shouldBuffer(tradeTime?: Date | null) {
    if (!tradeTime) {
      return false;
    }

    const hours = tradeTime.getUTCHours();
    const minutes = tradeTime.getUTCMinutes();
    const totalMinutes = hours * 60 + minutes;

    return totalMinutes >= 23 * 60 + 55 || totalMinutes <= 5;
  }
}

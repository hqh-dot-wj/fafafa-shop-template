import { Injectable } from '@nestjs/common';
import {
  CommissionStatus,
  FinRefund,
  FinRefundStatus,
  FinSettlementBill,
  FinTenantSettlementProfile,
  PaymentRecordStatus,
  Prisma,
  ReconciliationStatus,
  SettlementBillStatus,
  SettlementChannelType,
  SettlementExecutionStatus,
  SettlementProfileStatus,
  SettlementReceiverType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { BusinessException } from 'src/common/exceptions';
import { Result } from 'src/common/response';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { FormatDateFields } from 'src/common/utils';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditSettlementBillDto } from './dto/audit-settlement-bill.dto';
import { ExecuteSettlementBillDto } from './dto/execute-settlement-bill.dto';
import { HandleReconciliationIssueDto } from './dto/handle-reconciliation-issue.dto';
import { ListPaymentRecordDto } from './dto/list-payment-record.dto';
import { ListReconciliationIssueDto } from './dto/list-reconciliation-issue.dto';
import { ListSettlementBillDto } from './dto/list-settlement-bill.dto';
import { UpdateTenantSettlementProfileDto } from './dto/update-tenant-settlement-profile.dto';
import { SettlementExecutionService } from './settlement-execution.service';

interface EnsureTenantProfileInput {
  enabled?: boolean;
  defaultChannel?: SettlementChannelType;
  receiverType?: SettlementReceiverType;
  receiverAccount?: string;
  receiverName?: string;
  bankName?: string;
  bankAccountNo?: string;
  needManualReview?: boolean;
  status?: SettlementProfileStatus;
  remark?: string;
}

interface RecordPaidOrderInput {
  orderId: string;
  tenantId: string;
  orderSn: string;
  transactionId: string;
  payAmount: number;
  channelType: string;
  payTime: Date;
  rawPayload?: Prisma.InputJsonValue;
}

interface SettlementSnapshot {
  order: {
    id: string;
    orderSn: string;
    payAmount: Decimal;
  };
  profile: FinTenantSettlementProfile;
  payRecordId: string | null;
  totalAmount: Decimal;
  platformAmount: Decimal;
  storeAmount: Decimal;
  commissionAmount: Decimal;
  crossTenantAmount: Decimal;
  refundAmount: Decimal;
  refundFeeAmount: Decimal;
}

type FinSettlementBillWithRelations = Prisma.FinSettlementBillGetPayload<{
  include: {
    order: true;
    payRecord: true;
    items: true;
    audits: true;
    executions: { include: { logs: true } };
  };
}>;

@Injectable()
export class SettlementCoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
    private readonly settlementExecutionService: SettlementExecutionService,
  ) {}

  async ensureTenantProfile(tenantId: string, input: EnsureTenantProfileInput = {}) {
    const existing = await this.prisma.finTenantSettlementProfile.findUnique({
      where: { tenantId },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.finTenantSettlementProfile.create({
      data: this.buildProfileCreateData(tenantId, input),
    });
  }

  async getTenantProfile(tenantId: string) {
    const profile = await this.ensureTenantProfile(tenantId);
    return Result.ok(this.formatProfile(profile));
  }

  async saveTenantProfile(tenantId: string, dto: UpdateTenantSettlementProfileDto) {
    const profile = await this.prisma.finTenantSettlementProfile.upsert({
      where: { tenantId },
      create: this.buildProfileCreateData(tenantId, dto),
      update: this.buildProfileUpdateData(dto),
    });

    return Result.ok(this.formatProfile(profile), '结算配置已保存');
  }

  async recordPaidOrder(input: RecordPaidOrderInput) {
    await this.ensureTenantProfile(input.tenantId);

    const payment = await this.prisma.payOrderRecord.upsert({
      where: { orderId: input.orderId },
      create: {
        orderId: input.orderId,
        orderSn: input.orderSn,
        tenantId: input.tenantId,
        channelType: input.channelType,
        transactionId: input.transactionId,
        payAmount: input.payAmount,
        status: PaymentRecordStatus.SUCCESS,
        payTime: input.payTime,
        rawPayload: input.rawPayload,
      },
      update: {
        orderSn: input.orderSn,
        channelType: input.channelType,
        transactionId: input.transactionId,
        payAmount: input.payAmount,
        status: PaymentRecordStatus.SUCCESS,
        payTime: input.payTime,
        rawPayload: input.rawPayload,
      },
    });

    await this.syncSettlementBill(input.orderId, input.tenantId, {
      payRecordId: payment.id,
      readyForReview: false,
    });

    return payment;
  }

  async refreshSettlementBillFromOrder(orderId: string, tenantId: string) {
    return this.syncSettlementBill(orderId, tenantId, {
      readyForReview: true,
    });
  }

  async handleSuccessfulRefundSettlement(refund: FinRefund) {
    if (refund.status !== FinRefundStatus.SUCCESS) {
      return { action: 'SKIPPED' as const };
    }

    const existingBill = await this.prisma.finSettlementBill.findFirst({
      where: { orderId: refund.orderId, tenantId: refund.tenantId },
    });

    if (!existingBill || !this.isBillLocked(existingBill.status)) {
      const bill = await this.syncSettlementBill(refund.orderId, refund.tenantId, {
        readyForReview: true,
      });
      return { action: 'REFRESHED' as const, billId: bill.id };
    }

    const snapshot = await this.buildSettlementSnapshot(refund.orderId, refund.tenantId, existingBill);
    const adjustment = await this.createRefundSettlementAdjustment(refund, existingBill, snapshot);

    return { action: 'ADJUSTED' as const, billId: existingBill.id, adjustmentId: adjustment.id };
  }

  async listPaymentRecords(query: ListPaymentRecordDto) {
    const where: Prisma.PayOrderRecordWhereInput = {
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.orderSn ? { orderSn: { contains: query.orderSn } } : {}),
      ...(query.transactionId ? { transactionId: { contains: query.transactionId } } : {}),
      ...(query.getDateRange('createTime') ?? {}),
    };

    const scopedWhere = this.tenantHelper.readWhereForDelegate(
      'payOrderRecord',
      where as object,
    ) as Prisma.PayOrderRecordWhereInput;

    const [rows, total] = await Promise.all([
      this.prisma.payOrderRecord.findMany({
        where: scopedWhere,
        include: {
          order: {
            select: {
              id: true,
              orderSn: true,
              memberId: true,
              payStatus: true,
              status: true,
            },
          },
        },
        orderBy: query.getOrderBy('createTime') ?? { createTime: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.payOrderRecord.count({ where: scopedWhere }),
    ]);

    return Result.page(
      rows.map((row) => ({
        id: row.id,
        orderId: row.orderId,
        orderSn: row.orderSn,
        tenantId: row.tenantId,
        channelType: row.channelType,
        transactionId: row.transactionId,
        payAmount: Number(row.payAmount),
        status: row.status,
        payTime: row.payTime,
        createTime: row.createTime,
        orderStatus: row.order.status,
        payStatus: row.order.payStatus,
        memberId: row.order.memberId,
      })),
      total,
      query.pageNum,
      query.pageSize,
    );
  }

  async listSettlementBills(query: ListSettlementBillDto) {
    const where: Prisma.FinSettlementBillWhereInput = {
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.billNo ? { billNo: { contains: query.billNo } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.channelType ? { channelType: query.channelType } : {}),
      ...(query.orderSn
        ? {
            order: {
              orderSn: { contains: query.orderSn },
            },
          }
        : {}),
      ...(query.getDateRange('createTime') ?? {}),
    };

    const scopedWhere = this.tenantHelper.readWhereForDelegate(
      'finSettlementBill',
      where as object,
    ) as Prisma.FinSettlementBillWhereInput;

    const [rows, total] = await Promise.all([
      this.prisma.finSettlementBill.findMany({
        where: scopedWhere,
        include: {
          order: {
            select: {
              id: true,
              orderSn: true,
              memberId: true,
              payAmount: true,
              payTime: true,
              status: true,
              payStatus: true,
            },
          },
          payRecord: {
            select: {
              id: true,
              transactionId: true,
              status: true,
              channelType: true,
              payTime: true,
            },
          },
          executions: {
            select: {
              id: true,
              status: true,
              channelType: true,
              externalNo: true,
              createTime: true,
            },
            orderBy: { createTime: 'desc' },
            take: 1,
          },
        },
        orderBy: query.getOrderBy('createTime') ?? { createTime: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.finSettlementBill.count({ where: scopedWhere }),
    ]);

    return Result.page(
      rows.map((row) => ({
        id: row.id,
        billNo: row.billNo,
        orderId: row.orderId,
        orderSn: row.order.orderSn,
        tenantId: row.tenantId,
        totalAmount: Number(row.totalAmount),
        platformAmount: Number(row.platformAmount),
        storeAmount: Number(row.storeAmount),
        commissionAmount: Number(row.commissionAmount),
        crossTenantAmount: Number(row.crossTenantAmount),
        channelType: row.channelType,
        status: row.status,
        payRecordStatus: row.payRecord?.status ?? null,
        latestExecutionStatus: row.executions[0]?.status ?? null,
        latestExecutionNo: row.executions[0]?.externalNo ?? null,
        createTime: row.createTime,
        updateTime: row.updateTime,
      })),
      total,
      query.pageNum,
      query.pageSize,
    );
  }

  async getSettlementBillDetail(id: string) {
    const bill = await this.prisma.finSettlementBill.findFirst({
      where: this.tenantHelper.readWhereForDelegate('finSettlementBill', {
        id,
      } as object) as Prisma.FinSettlementBillWhereInput,
      include: {
        order: true,
        payRecord: true,
        items: true,
        audits: {
          orderBy: { createTime: 'desc' },
        },
        executions: {
          include: {
            logs: {
              orderBy: { createTime: 'desc' },
            },
          },
          orderBy: { createTime: 'desc' },
        },
      },
    });

    BusinessException.throwIfNull(bill, '应结算单不存在');

    return Result.ok(this.formatSettlementBillDetail(bill));
  }

  async auditSettlementBill(dto: AuditSettlementBillDto, auditBy: string) {
    const bill = await this.prisma.finSettlementBill.findFirst({
      where: this.tenantHelper.readWhereForDelegate('finSettlementBill', {
        id: dto.billId,
      } as object) as Prisma.FinSettlementBillWhereInput,
    });
    BusinessException.throwIfNull(bill, '应结算单不存在');

    const auditableStatuses: SettlementBillStatus[] = [
      SettlementBillStatus.PENDING_REVIEW,
      SettlementBillStatus.REJECTED,
    ];
    BusinessException.throwIf(!auditableStatuses.includes(bill.status), '当前状态不允许审核');

    const nextStatus = dto.action === 'APPROVE' ? SettlementBillStatus.APPROVED : SettlementBillStatus.REJECTED;

    const [updatedBill] = await this.prisma.$transaction([
      this.prisma.finSettlementBill.update({
        where: { id: dto.billId },
        data: {
          status: nextStatus,
          remark: dto.remark ?? bill.remark,
        },
      }),
      this.prisma.finSettlementAuditLog.create({
        data: {
          billId: dto.billId,
          tenantId: bill.tenantId,
          action: dto.action,
          auditBy,
          remark: dto.remark,
        },
      }),
    ]);

    return Result.ok(
      FormatDateFields({
        id: updatedBill.id,
        billNo: updatedBill.billNo,
        status: updatedBill.status,
        updateTime: updatedBill.updateTime,
      }),
      dto.action === 'APPROVE' ? '审核通过' : '审核已驳回',
    );
  }

  async executeSettlementBill(dto: ExecuteSettlementBillDto, operator: string) {
    const bill = await this.prisma.finSettlementBill.findFirst({
      where: this.tenantHelper.readWhereForDelegate('finSettlementBill', {
        id: dto.billId,
      } as object) as Prisma.FinSettlementBillWhereInput,
      include: {
        payRecord: {
          select: {
            id: true,
            transactionId: true,
            channelType: true,
          },
        },
        items: {
          select: {
            id: true,
            receiverType: true,
            receiverId: true,
            receiverName: true,
            amount: true,
            reason: true,
          },
        },
        executions: {
          orderBy: { createTime: 'desc' },
          take: 1,
        },
      },
    });
    BusinessException.throwIfNull(bill, '应结算单不存在');

    const executableBillStatuses: SettlementBillStatus[] = [SettlementBillStatus.APPROVED, SettlementBillStatus.FAILED];
    BusinessException.throwIf(!executableBillStatuses.includes(bill.status), '当前状态不允许执行');

    const lastExecution = bill.executions[0];
    const processingExecutionStatuses: SettlementExecutionStatus[] = [
      SettlementExecutionStatus.PENDING,
      SettlementExecutionStatus.PROCESSING,
    ];
    BusinessException.throwIf(
      !!lastExecution && processingExecutionStatuses.includes(lastExecution.status),
      '已有执行中的结算单，请先等待结果',
    );

    const channelType = dto.channelType ?? bill.channelType;
    const canMarkSuccess = dto.markAsSuccess && this.isManualSettlementChannel(channelType);
    const executeNo = `STE-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const executionResult = canMarkSuccess
      ? {
          executionStatus: SettlementExecutionStatus.SUCCESS,
          billStatus: SettlementBillStatus.SUCCESS,
          issueStatus: ReconciliationStatus.MATCHED,
          externalNo: dto.externalNo ?? null,
          stage: 'MANUAL_SUCCESS',
          message: '手工结算已确认成功',
          requestPayload: {
            operator,
            remark: dto.remark ?? null,
            markAsSuccess: true,
          },
          responsePayload: {
            settledAt: new Date().toISOString(),
            mode: 'manual-confirmed',
          },
          failureReason: null,
        }
      : await this.settlementExecutionService.execute({
          executeNo,
          operator,
          channelType,
          bill,
        });

    const execution = await this.prisma.finSettlementExecution.create({
      data: {
        billId: bill.id,
        tenantId: bill.tenantId,
        executeNo,
        channelType,
        status: executionResult.executionStatus,
        externalNo: executionResult.externalNo ?? dto.externalNo,
        requestPayload: executionResult.requestPayload ?? {
          operator,
          remark: dto.remark ?? null,
          markAsSuccess: !!dto.markAsSuccess,
        },
        responsePayload: executionResult.responsePayload ?? null,
        failureReason: executionResult.failureReason ?? null,
      },
    });

    await this.prisma.finSettlementBill.update({
      where: { id: bill.id },
      data: {
        status: executionResult.billStatus,
        channelType,
        remark: dto.remark ?? bill.remark,
      },
    });

    await this.prisma.finSettlementExecutionLog.create({
      data: {
        executionId: execution.id,
        tenantId: bill.tenantId,
        stage: executionResult.stage,
        message: executionResult.message,
        payload: {
          operator,
          externalNo: executionResult.externalNo ?? dto.externalNo ?? null,
          remark: dto.remark ?? null,
          requestPayload: executionResult.requestPayload ?? null,
          responsePayload: executionResult.responsePayload ?? null,
        },
      },
    });

    await this.syncReconciliationIssueForExecution({
      billId: bill.id,
      orderId: bill.orderId,
      executionId: execution.id,
      tenantId: bill.tenantId,
      operator,
      issueStatus: executionResult.issueStatus,
      issueType:
        executionResult.issueStatus === ReconciliationStatus.MATCHED
          ? 'EXECUTION_MATCHED'
          : executionResult.issueStatus === ReconciliationStatus.UNMATCHED
            ? 'EXECUTION_FAILED'
            : 'EXECUTION_PENDING',
      issueReason: executionResult.message,
      remark: dto.remark,
    });

    return Result.ok(
      FormatDateFields({
        executionId: execution.id,
        executeNo: execution.executeNo,
        billId: bill.id,
        billNo: bill.billNo,
        channelType,
        status: execution.status,
        externalNo: execution.externalNo,
        createTime: execution.createTime,
      }),
      canMarkSuccess || executionResult.executionStatus === SettlementExecutionStatus.SUCCESS
        ? '结算执行成功'
        : '结算执行已创建',
    );
  }

  async listReconciliationIssues(query: ListReconciliationIssueDto) {
    const where: Prisma.FinReconciliationIssueWhereInput = {
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.issueType ? { issueType: query.issueType } : {}),
      ...(query.getDateRange('createTime') ?? {}),
    };

    if (query.billNo || query.orderSn) {
      const bills = await this.prisma.finSettlementBill.findMany({
        where: this.tenantHelper.readWhereForDelegate('finSettlementBill', {
          ...(query.tenantId ? { tenantId: query.tenantId } : {}),
          ...(query.billNo ? { billNo: { contains: query.billNo } } : {}),
          ...(query.orderSn
            ? {
                order: {
                  orderSn: { contains: query.orderSn },
                },
              }
            : {}),
        } as object) as Prisma.FinSettlementBillWhereInput,
        select: {
          id: true,
        },
      });

      where.billId = {
        in: bills.map((bill) => bill.id),
      };
    }

    const scopedWhere = this.tenantHelper.readWhereForDelegate(
      'finReconciliationIssue',
      where as object,
    ) as Prisma.FinReconciliationIssueWhereInput;

    const [issues, total] = await Promise.all([
      this.prisma.finReconciliationIssue.findMany({
        where: scopedWhere,
        orderBy: query.getOrderBy('createTime') ?? { createTime: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.finReconciliationIssue.count({ where: scopedWhere }),
    ]);

    const billIds = issues.map((issue) => issue.billId).filter((value): value is string => !!value);
    const executionIds = issues.map((issue) => issue.executionId).filter((value): value is string => !!value);
    const rawOrderIds = issues.map((issue) => issue.orderId).filter((value): value is string => !!value);
    const tenantIds = Array.from(new Set(issues.map((issue) => issue.tenantId)));

    const [bills, executions] = await Promise.all([
      billIds.length > 0
        ? this.prisma.finSettlementBill.findMany({
            where: { id: { in: billIds }, tenantId: { in: tenantIds } },
            select: {
              id: true,
              tenantId: true,
              billNo: true,
              status: true,
              orderId: true,
            },
          })
        : Promise.resolve([]),
      executionIds.length > 0
        ? this.prisma.finSettlementExecution.findMany({
            where: { id: { in: executionIds }, tenantId: { in: tenantIds } },
            select: {
              id: true,
              tenantId: true,
              executeNo: true,
              status: true,
              channelType: true,
              externalNo: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const orderIds = Array.from(new Set([...rawOrderIds, ...bills.map((bill) => bill.orderId)]));
    const orders =
      orderIds.length > 0
        ? await this.prisma.omsOrder.findMany({
            where: { id: { in: orderIds }, tenantId: { in: tenantIds } },
            select: {
              id: true,
              tenantId: true,
              orderSn: true,
            },
          })
        : [];

    const billMap = new Map(bills.map((bill) => [bill.id, bill]));
    const executionMap = new Map(executions.map((execution) => [execution.id, execution]));
    const orderMap = new Map(orders.map((order) => [order.id, order]));

    return Result.page(
      issues.map((issue) => {
        const rawBill = issue.billId ? (billMap.get(issue.billId) ?? null) : null;
        const rawExecution = issue.executionId ? (executionMap.get(issue.executionId) ?? null) : null;
        const bill = rawBill?.tenantId === issue.tenantId ? rawBill : null;
        const execution = rawExecution?.tenantId === issue.tenantId ? rawExecution : null;
        const orderId = issue.orderId ?? bill?.orderId ?? null;
        const rawOrder = orderId ? (orderMap.get(orderId) ?? null) : null;
        const order = rawOrder?.tenantId === issue.tenantId ? rawOrder : null;

        return FormatDateFields({
          id: issue.id,
          tenantId: issue.tenantId,
          orderId,
          orderSn: order?.orderSn ?? null,
          billId: issue.billId,
          billNo: bill?.billNo ?? null,
          billStatus: bill?.status ?? null,
          executionId: issue.executionId,
          executeNo: execution?.executeNo ?? null,
          executionStatus: execution?.status ?? null,
          channelType: execution?.channelType ?? null,
          externalNo: execution?.externalNo ?? null,
          issueType: issue.issueType,
          status: issue.status,
          diffAmount: issue.diffAmount == null ? null : Number(issue.diffAmount),
          issueReason: issue.issueReason,
          handledBy: issue.handledBy,
          handledRemark: issue.handledRemark,
          handledTime: issue.handledTime,
          createTime: issue.createTime,
          updateTime: issue.updateTime,
        });
      }),
      total,
      query.pageNum,
      query.pageSize,
    );
  }

  async getReconciliationIssueDetail(id: string) {
    const issue = await this.prisma.finReconciliationIssue.findFirst({
      where: this.tenantHelper.readWhereForDelegate('finReconciliationIssue', {
        id,
      } as object) as Prisma.FinReconciliationIssueWhereInput,
    });
    BusinessException.throwIfNull(issue, '对账异常不存在');

    const [bill, execution] = await Promise.all([
      issue.billId
        ? this.prisma.finSettlementBill.findFirst({
            where: { id: issue.billId, tenantId: issue.tenantId },
            select: {
              id: true,
              tenantId: true,
              billNo: true,
              status: true,
              orderId: true,
            },
          })
        : Promise.resolve(null),
      issue.executionId
        ? this.prisma.finSettlementExecution.findFirst({
            where: { id: issue.executionId, tenantId: issue.tenantId },
            select: {
              id: true,
              tenantId: true,
              executeNo: true,
              status: true,
              channelType: true,
              externalNo: true,
            },
          })
        : Promise.resolve(null),
    ]);

    const orderId = issue.orderId ?? bill?.orderId ?? null;
    const order = orderId
      ? await this.prisma.omsOrder.findFirst({
          where: { id: orderId, tenantId: issue.tenantId },
          select: {
            id: true,
            tenantId: true,
            orderSn: true,
          },
        })
      : null;

    return Result.ok(
      FormatDateFields({
        id: issue.id,
        batchId: issue.batchId,
        resultId: issue.resultId,
        bizScope: issue.bizScope,
        tenantId: issue.tenantId,
        localBizId: issue.localBizId,
        localBizNo: issue.localBizNo,
        channelBizNo: issue.channelBizNo,
        transactionId: issue.transactionId,
        orderId,
        orderSn: order?.orderSn ?? null,
        billId: issue.billId,
        billNo: bill?.billNo ?? null,
        billStatus: bill?.status ?? null,
        executionId: issue.executionId,
        executeNo: execution?.executeNo ?? null,
        executionStatus: execution?.status ?? null,
        channelType: issue.channelType ?? execution?.channelType ?? null,
        externalNo: execution?.externalNo ?? null,
        issueType: issue.issueType,
        status: issue.status,
        diffAmount: issue.diffAmount == null ? null : Number(issue.diffAmount),
        issueReason: issue.issueReason,
        handledBy: issue.handledBy,
        handledRemark: issue.handledRemark,
        handledTime: issue.handledTime,
        createTime: issue.createTime,
        updateTime: issue.updateTime,
      }),
    );
  }

  async handleReconciliationIssue(dto: HandleReconciliationIssueDto, operator: string) {
    const issue = await this.prisma.finReconciliationIssue.findFirst({
      where: this.tenantHelper.readWhereForDelegate('finReconciliationIssue', {
        id: dto.issueId,
      } as object) as Prisma.FinReconciliationIssueWhereInput,
    });
    BusinessException.throwIfNull(issue, '对账异常不存在');

    const finalStatuses: ReconciliationStatus[] = [ReconciliationStatus.MATCHED, ReconciliationStatus.HANDLED];
    BusinessException.throwIf(finalStatuses.includes(issue.status), '当前异常已处理完成');

    const targetIssueStatus =
      dto.action === 'MARK_SUCCESS' ? ReconciliationStatus.MATCHED : ReconciliationStatus.HANDLED;
    const targetBillStatus =
      dto.action === 'MARK_SUCCESS'
        ? SettlementBillStatus.SUCCESS
        : dto.action === 'MARK_FAILED'
          ? SettlementBillStatus.FAILED
          : SettlementBillStatus.CLOSED;
    const targetExecutionStatus =
      dto.action === 'MARK_SUCCESS'
        ? SettlementExecutionStatus.SUCCESS
        : dto.action === 'MARK_FAILED'
          ? SettlementExecutionStatus.FAILED
          : SettlementExecutionStatus.CLOSED;

    await this.prisma.$transaction(async (tx) => {
      await tx.finReconciliationIssue.update({
        where: { id: issue.id },
        data: {
          status: targetIssueStatus,
          handledBy: operator,
          handledRemark: dto.remark,
          handledTime: new Date(),
        },
      });

      if (issue.billId) {
        await tx.finSettlementBill.update({
          where: { id: issue.billId },
          data: {
            status: targetBillStatus,
            remark: dto.remark ?? undefined,
          },
        });
      }

      if (issue.executionId) {
        await tx.finSettlementExecution.update({
          where: { id: issue.executionId },
          data: {
            status: targetExecutionStatus,
            externalNo: dto.externalNo,
            failureReason: dto.action === 'MARK_FAILED' ? (dto.remark ?? '人工确认失败') : null,
            responsePayload: {
              resolvedAt: new Date().toISOString(),
              resolvedBy: operator,
              action: dto.action,
              remark: dto.remark ?? null,
            },
          },
        });

        await tx.finSettlementExecutionLog.create({
          data: {
            executionId: issue.executionId,
            tenantId: issue.tenantId,
            stage: dto.action,
            message:
              dto.action === 'MARK_SUCCESS'
                ? '对账异常已人工确认成功'
                : dto.action === 'MARK_FAILED'
                  ? '对账异常已人工确认失败'
                  : '对账异常已关闭处理',
            payload: {
              operator,
              externalNo: dto.externalNo ?? null,
              remark: dto.remark ?? null,
            },
          },
        });
      }
    });

    return Result.ok(
      FormatDateFields({
        id: issue.id,
        status: targetIssueStatus,
        handledBy: operator,
        handledTime: new Date(),
      }),
      '对账异常已处理',
    );
  }

  private async syncSettlementBill(
    orderId: string,
    tenantId: string,
    options: {
      payRecordId?: string;
      readyForReview: boolean;
    },
  ) {
    const existingBill = await this.prisma.finSettlementBill.findFirst({
      where: { orderId, tenantId },
      include: { items: true },
    });

    if (existingBill && this.isBillLocked(existingBill.status)) {
      return existingBill;
    }

    const snapshot = await this.buildSettlementSnapshot(orderId, tenantId, existingBill, options.payRecordId);

    const bill = await this.prisma.finSettlementBill.upsert({
      where: { orderId },
      create: {
        billNo: `STL-${snapshot.order.orderSn}`,
        orderId,
        tenantId,
        payRecordId: snapshot.payRecordId,
        totalAmount: snapshot.totalAmount,
        platformAmount: snapshot.platformAmount,
        storeAmount: snapshot.storeAmount,
        commissionAmount: snapshot.commissionAmount,
        crossTenantAmount: snapshot.crossTenantAmount,
        channelType: snapshot.profile.defaultChannel,
        status: this.resolveBillStatus(undefined, snapshot.profile.needManualReview, options.readyForReview),
        remark: options.readyForReview ? '佣金计算完成，可进入审核' : '支付成功，等待佣金回算',
      },
      update: {
        payRecordId: snapshot.payRecordId,
        totalAmount: snapshot.totalAmount,
        platformAmount: snapshot.platformAmount,
        storeAmount: snapshot.storeAmount,
        commissionAmount: snapshot.commissionAmount,
        crossTenantAmount: snapshot.crossTenantAmount,
        channelType: snapshot.profile.defaultChannel,
        status: this.resolveBillStatus(existingBill?.status, snapshot.profile.needManualReview, options.readyForReview),
        remark: options.readyForReview ? '佣金计算完成，可进入审核' : '支付成功，等待佣金回算',
      },
    });

    await this.prisma.finSettlementBillItem.deleteMany({
      where: { billId: bill.id },
    });

    if (snapshot.storeAmount.gt(0)) {
      await this.prisma.finSettlementBillItem.create({
        data: {
          billId: bill.id,
          tenantId,
          receiverType: snapshot.profile.receiverType,
          receiverId: snapshot.profile.receiverAccount || tenantId,
          receiverName: snapshot.profile.receiverName || null,
          channelType: snapshot.profile.defaultChannel,
          amount: snapshot.storeAmount,
          reason: '门店应收',
        },
      });
    }

    return bill;
  }

  private async buildSettlementSnapshot(
    orderId: string,
    tenantId: string,
    existingBill?: Pick<FinSettlementBill, 'payRecordId'> | null,
    explicitPayRecordId?: string,
  ): Promise<SettlementSnapshot> {
    const order = await this.prisma.omsOrder.findFirst({
      where: { id: orderId, tenantId },
      select: {
        id: true,
        orderSn: true,
        payAmount: true,
      },
    });
    BusinessException.throwIfNull(order, '订单不存在');

    const profile = await this.ensureTenantProfile(tenantId);
    const [commissionAgg, crossTenantAgg, refundAgg, payRecord] = await Promise.all([
      this.prisma.finCommission.aggregate({
        where: {
          orderId,
          tenantId,
          status: { not: CommissionStatus.CANCELLED },
        },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.finCommission.aggregate({
        where: {
          orderId,
          tenantId,
          isCrossTenant: true,
          status: { not: CommissionStatus.CANCELLED },
        },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.finRefund.aggregate({
        where: {
          orderId,
          tenantId,
          status: FinRefundStatus.SUCCESS,
        },
        _sum: {
          // 结算口径：以 settlementRefundAmount（商户结算实退）为准，
          // 退款回调缺该字段时回落 payerRefundAmount（用户实退），最后兜底 requestedAmount（申请额）。
          // 三者数学关系：settlement = payer - refundFee（手续费商家承担时）。
          settlementRefundAmount: true,
          payerRefundAmount: true,
          requestedAmount: true,
          refundFeeAmount: true,
        },
      }),
      this.prisma.payOrderRecord.findFirst({
        where: { orderId, tenantId },
      }),
    ]);

    // 退款金额聚合的 fallback chain：settlement → payer → requested。
    // 之前直接用 requestedAmount 会在网关只退一部分时多扣 totalAmount，导致商家少结。
    const refundAmount = this.toMoney(
      refundAgg._sum.settlementRefundAmount ?? refundAgg._sum.payerRefundAmount ?? refundAgg._sum.requestedAmount ?? 0,
    );
    const refundFeeAmount = this.toMoney(refundAgg._sum.refundFeeAmount ?? 0);
    const totalAmount = Decimal.max(this.toMoney(order.payAmount).minus(refundAmount), 0).toDecimalPlaces(2);
    const commissionAmount = this.toMoney(commissionAgg._sum.amount ?? 0);
    const crossTenantAmount = this.toMoney(crossTenantAgg._sum.amount ?? 0);
    const platformAmount = new Decimal(0);
    // 退款手续费由商家承担（微信默认规则）：在 storeAmount 公式里直接扣减，
    // 避免 admin-web 展示的"门店应收"与实际打款金额不一致。
    // FinSettlementAdjustment.feeAmountDelta 保留作为审计记录。
    const storeAmount = Decimal.max(
      totalAmount.minus(platformAmount).minus(commissionAmount).minus(refundFeeAmount),
      0,
    ).toDecimalPlaces(2);
    const payRecordId = explicitPayRecordId ?? payRecord?.id ?? existingBill?.payRecordId ?? null;

    return {
      order,
      profile,
      payRecordId,
      totalAmount,
      platformAmount,
      storeAmount,
      commissionAmount,
      crossTenantAmount,
      refundAmount,
      refundFeeAmount,
    };
  }

  private async createRefundSettlementAdjustment(
    refund: FinRefund,
    bill: FinSettlementBill,
    snapshot: SettlementSnapshot,
  ) {
    const storeAmountDelta = snapshot.storeAmount.minus(bill.storeAmount).toDecimalPlaces(2);
    const commissionAmountDelta = snapshot.commissionAmount.minus(bill.commissionAmount).toDecimalPlaces(2);
    const platformAmountDelta = snapshot.platformAmount.minus(bill.platformAmount).toDecimalPlaces(2);
    const feeAmountDelta = this.toMoney(refund.refundFeeAmount ?? snapshot.refundFeeAmount);

    return this.prisma.finSettlementAdjustment.upsert({
      where: { refundRecordId: refund.id },
      create: {
        adjustmentNo: `STA-${refund.refundSn}`,
        tenantId: refund.tenantId,
        orderId: refund.orderId,
        refundRecordId: refund.id,
        settlementBillId: bill.id,
        adjustmentType: 'REFUND_DEDUCT',
        status: 'PENDING',
        storeAmountDelta,
        commissionAmountDelta,
        platformAmountDelta,
        feeAmountDelta,
        reason: `退款成功后生成结算调整：${refund.refundSn}`,
        rawPayload: this.buildSettlementAdjustmentPayload(refund, bill, snapshot),
      },
      update: {
        settlementBillId: bill.id,
        storeAmountDelta,
        commissionAmountDelta,
        platformAmountDelta,
        feeAmountDelta,
        rawPayload: this.buildSettlementAdjustmentPayload(refund, bill, snapshot),
      },
    });
  }

  private buildSettlementAdjustmentPayload(
    refund: FinRefund,
    bill: FinSettlementBill,
    snapshot: SettlementSnapshot,
  ): Prisma.InputJsonObject {
    return {
      refundSn: refund.refundSn,
      refundRecordId: refund.id,
      settlementBillId: bill.id,
      original: {
        totalAmount: this.toMoney(bill.totalAmount).toFixed(2),
        storeAmount: this.toMoney(bill.storeAmount).toFixed(2),
        commissionAmount: this.toMoney(bill.commissionAmount).toFixed(2),
        platformAmount: this.toMoney(bill.platformAmount).toFixed(2),
      },
      recalculated: {
        totalAmount: snapshot.totalAmount.toFixed(2),
        storeAmount: snapshot.storeAmount.toFixed(2),
        commissionAmount: snapshot.commissionAmount.toFixed(2),
        platformAmount: snapshot.platformAmount.toFixed(2),
        refundAmount: snapshot.refundAmount.toFixed(2),
        refundFeeAmount: snapshot.refundFeeAmount.toFixed(2),
      },
    };
  }

  private toMoney(value: Decimal.Value) {
    return new Decimal(value).toDecimalPlaces(2);
  }

  private buildProfileCreateData(
    tenantId: string,
    input: EnsureTenantProfileInput,
  ): Prisma.FinTenantSettlementProfileCreateInput {
    const enabled = input.enabled ?? false;
    const status = this.resolveProfileStatus(enabled, input.status);

    return {
      tenant: {
        connect: { tenantId },
      },
      enabled,
      defaultChannel: input.defaultChannel ?? SettlementChannelType.OFFLINE_TRANSFER,
      receiverType: input.receiverType ?? SettlementReceiverType.TENANT,
      receiverAccount: input.receiverAccount,
      receiverName: input.receiverName,
      bankName: input.bankName,
      bankAccountNo: input.bankAccountNo,
      needManualReview: input.needManualReview ?? true,
      status,
      remark: input.remark,
    };
  }

  private buildProfileUpdateData(input: EnsureTenantProfileInput): Prisma.FinTenantSettlementProfileUpdateInput {
    return {
      enabled: input.enabled,
      defaultChannel: input.defaultChannel,
      receiverType: input.receiverType,
      receiverAccount: input.receiverAccount,
      receiverName: input.receiverName,
      bankName: input.bankName,
      bankAccountNo: input.bankAccountNo,
      needManualReview: input.needManualReview,
      status:
        input.status ??
        (input.enabled === undefined ? undefined : this.resolveProfileStatus(input.enabled, input.status)),
      remark: input.remark,
    };
  }

  private resolveProfileStatus(enabled: boolean, explicit?: SettlementProfileStatus) {
    if (explicit) {
      return explicit;
    }

    return enabled ? SettlementProfileStatus.ACTIVE : SettlementProfileStatus.DRAFT;
  }

  private resolveBillStatus(
    currentStatus: SettlementBillStatus | undefined,
    needManualReview: boolean,
    readyForReview: boolean,
  ) {
    if (currentStatus && this.isBillLocked(currentStatus)) {
      return currentStatus;
    }

    if (!readyForReview) {
      return SettlementBillStatus.INIT;
    }

    return needManualReview ? SettlementBillStatus.PENDING_REVIEW : SettlementBillStatus.APPROVED;
  }

  private resolveExecutionStatus(channelType: SettlementChannelType) {
    if (this.isManualSettlementChannel(channelType)) {
      return SettlementExecutionStatus.PROCESSING;
    }

    return SettlementExecutionStatus.PENDING;
  }

  private isManualSettlementChannel(channelType: SettlementChannelType) {
    const manualChannels: SettlementChannelType[] = [
      SettlementChannelType.BANK_TRANSFER,
      SettlementChannelType.OFFLINE_TRANSFER,
    ];

    return manualChannels.includes(channelType);
  }

  private isBillLocked(status: SettlementBillStatus) {
    const lockedStatuses: SettlementBillStatus[] = [
      SettlementBillStatus.APPROVED,
      SettlementBillStatus.EXECUTING,
      SettlementBillStatus.SUCCESS,
      SettlementBillStatus.FAILED,
      SettlementBillStatus.RECONCILING,
      SettlementBillStatus.CLOSED,
    ];

    return lockedStatuses.includes(status);
  }

  private async markIssueAsMatchedByBill(billId: string, operator: string, remark?: string) {
    await this.prisma.finReconciliationIssue.updateMany({
      where: {
        billId,
        status: {
          in: [ReconciliationStatus.WAITING, ReconciliationStatus.UNMATCHED],
        },
      },
      data: {
        status: ReconciliationStatus.MATCHED,
        handledBy: operator,
        handledRemark: remark,
        handledTime: new Date(),
      },
    });
  }

  async updateExecutionFromChannel(input: {
    executionId: string;
    operator: string;
    executionStatus: SettlementExecutionStatus;
    billStatus: SettlementBillStatus;
    issueStatus: ReconciliationStatus;
    externalNo?: string | null;
    stage: string;
    message: string;
    responsePayload?: Prisma.InputJsonValue | null;
    failureReason?: string | null;
  }) {
    const execution = await this.prisma.finSettlementExecution.findFirst({
      where: this.tenantHelper.readWhereForDelegate('finSettlementExecution', {
        id: input.executionId,
      } as object) as Prisma.FinSettlementExecutionWhereInput,
    });
    BusinessException.throwIfNull(execution, '结算执行单不存在');

    await this.prisma.$transaction(async (tx) => {
      const executionUpdateResult = await tx.finSettlementExecution.updateMany({
        where: { id: execution.id, tenantId: execution.tenantId },
        data: {
          status: input.executionStatus,
          externalNo: input.externalNo ?? execution.externalNo,
          responsePayload: input.responsePayload ?? undefined,
          failureReason: input.failureReason ?? null,
        },
      });
      BusinessException.throwIf(executionUpdateResult.count === 0, '结算执行单已变化，请刷新后重试');

      const billUpdateResult = await tx.finSettlementBill.updateMany({
        where: { id: execution.billId, tenantId: execution.tenantId },
        data: {
          status: input.billStatus,
          remark: input.message,
        },
      });
      BusinessException.throwIf(billUpdateResult.count === 0, '结算单已变化，请刷新后重试');

      await tx.finSettlementExecutionLog.create({
        data: {
          executionId: execution.id,
          tenantId: execution.tenantId,
          stage: input.stage,
          message: input.message,
          payload: {
            externalNo: input.externalNo ?? null,
            responsePayload: input.responsePayload ?? null,
            failureReason: input.failureReason ?? null,
          },
        },
      });
    });

    await this.syncReconciliationIssueForExecution({
      billId: execution.billId,
      orderId: null,
      executionId: execution.id,
      tenantId: execution.tenantId,
      operator: input.operator,
      issueStatus: input.issueStatus,
      issueType:
        input.issueStatus === ReconciliationStatus.MATCHED
          ? 'EXECUTION_MATCHED'
          : input.issueStatus === ReconciliationStatus.UNMATCHED
            ? 'EXECUTION_FAILED'
            : 'EXECUTION_PENDING',
      issueReason: input.message,
      remark: input.failureReason ?? input.message,
    });
  }

  private formatProfile(profile: FinTenantSettlementProfile) {
    return FormatDateFields({
      id: profile.id,
      tenantId: profile.tenantId,
      enabled: profile.enabled,
      defaultChannel: profile.defaultChannel,
      receiverType: profile.receiverType,
      receiverAccount: profile.receiverAccount,
      receiverName: profile.receiverName,
      bankName: profile.bankName,
      bankAccountNo: profile.bankAccountNo,
      needManualReview: profile.needManualReview,
      status: profile.status,
      remark: profile.remark,
      createTime: profile.createTime,
      updateTime: profile.updateTime,
    });
  }

  private formatSettlementBillDetail(bill: FinSettlementBillWithRelations) {
    return FormatDateFields({
      id: bill.id,
      billNo: bill.billNo,
      tenantId: bill.tenantId,
      orderId: bill.orderId,
      status: bill.status,
      channelType: bill.channelType,
      totalAmount: Number(bill.totalAmount),
      platformAmount: Number(bill.platformAmount),
      storeAmount: Number(bill.storeAmount),
      commissionAmount: Number(bill.commissionAmount),
      crossTenantAmount: Number(bill.crossTenantAmount),
      remark: bill.remark,
      createTime: bill.createTime,
      updateTime: bill.updateTime,
      order: {
        id: bill.order.id,
        orderSn: bill.order.orderSn,
        memberId: bill.order.memberId,
        status: bill.order.status,
        payStatus: bill.order.payStatus,
        payAmount: Number(bill.order.payAmount),
        payTime: bill.order.payTime,
      },
      payRecord: bill.payRecord
        ? {
            id: bill.payRecord.id,
            channelType: bill.payRecord.channelType,
            transactionId: bill.payRecord.transactionId,
            payAmount: Number(bill.payRecord.payAmount),
            status: bill.payRecord.status,
            payTime: bill.payRecord.payTime,
            createTime: bill.payRecord.createTime,
          }
        : null,
      items: bill.items.map((item) => ({
        id: item.id,
        receiverType: item.receiverType,
        receiverId: item.receiverId,
        receiverName: item.receiverName,
        channelType: item.channelType,
        amount: Number(item.amount),
        reason: item.reason,
        createTime: item.createTime,
      })),
      audits: bill.audits.map((audit) => ({
        id: audit.id,
        action: audit.action,
        auditBy: audit.auditBy,
        remark: audit.remark,
        createTime: audit.createTime,
      })),
      executions: bill.executions.map((execution) => ({
        id: execution.id,
        executeNo: execution.executeNo,
        channelType: execution.channelType,
        status: execution.status,
        externalNo: execution.externalNo,
        failureReason: execution.failureReason,
        createTime: execution.createTime,
        updateTime: execution.updateTime,
        logs: execution.logs.map((log) => ({
          id: log.id,
          stage: log.stage,
          message: log.message,
          payload: log.payload,
          createTime: log.createTime,
        })),
      })),
    });
  }

  private async syncReconciliationIssueForExecution(input: {
    billId: string;
    orderId: string | null;
    executionId: string;
    tenantId: string;
    operator: string;
    issueStatus: ReconciliationStatus;
    issueType: string;
    issueReason: string;
    remark?: string | null;
  }) {
    if (input.issueStatus === ReconciliationStatus.MATCHED) {
      await this.prisma.finReconciliationIssue.updateMany({
        where: {
          executionId: input.executionId,
          tenantId: input.tenantId,
        },
        data: {
          status: ReconciliationStatus.MATCHED,
          handledBy: input.operator,
          handledRemark: input.remark ?? input.issueReason,
          handledTime: new Date(),
        },
      });
      return;
    }

    const existingIssue = await this.prisma.finReconciliationIssue.findFirst({
      where: {
        executionId: input.executionId,
        tenantId: input.tenantId,
      },
    });

    if (existingIssue) {
      await this.prisma.finReconciliationIssue.updateMany({
        where: { id: existingIssue.id, tenantId: input.tenantId },
        data: {
          status: input.issueStatus,
          issueType: input.issueType,
          issueReason: input.issueReason,
        },
      });
      return;
    }

    await this.prisma.finReconciliationIssue.create({
      data: {
        tenantId: input.tenantId,
        orderId: input.orderId,
        billId: input.billId,
        executionId: input.executionId,
        issueType: input.issueType,
        status: input.issueStatus,
        issueReason: input.issueReason,
      },
    });
  }
}

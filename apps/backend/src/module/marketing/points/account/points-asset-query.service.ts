import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Result } from 'src/common/response/result';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { FormatDateFields } from 'src/common/utils';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  PointsConsumeAllocationQueryDto,
  PointsDebtQueryDto,
  PointsFreezeAllocationQueryDto,
  PointsLotQueryDto,
  PointsRefundAllocationQueryDto,
} from './dto/points-asset-query.dto';
import {
  PointsAssetLotBriefVo,
  PointsAssetTransactionBriefVo,
  PointsConsumeAllocationVo,
  PointsDebtVo,
  PointsFreezeAllocationVo,
  PointsLotVo,
  PointsRefundAllocationVo,
} from './vo/points-asset.vo';

type PageInput = {
  pageNum?: number;
  pageSize?: number;
};

type TransactionBriefSource = {
  id: string;
  type: PointsAssetTransactionBriefVo['type'];
  amount: number;
  status: PointsAssetTransactionBriefVo['status'];
  relatedId: string | null;
  relatedType: string | null;
  remark: string | null;
  createTime: Date;
};

type LotBriefSource = {
  id: string;
  sourceTransactionId: string | null;
  sourceType: PointsAssetLotBriefVo['sourceType'];
  totalAmount: number;
  availableAmount: number;
  frozenAmount: number;
  consumedAmount: number;
  expiredAmount: number;
  expireTime: Date | null;
  status: PointsAssetLotBriefVo['status'];
};

type LotRow = Prisma.MktPointsLotGetPayload<{ include: { sourceTransaction: true } }>;
type FreezeAllocationRow = Prisma.MktPointsFreezeAllocationGetPayload<{
  include: { lot: true; freezeTransaction: true; releaseTransaction: true };
}>;
type ConsumeAllocationRow = Prisma.MktPointsConsumeAllocationGetPayload<{
  include: { lot: true; spendTransaction: true };
}>;
type RefundAllocationRow = Prisma.MktPointsRefundAllocationGetPayload<{
  include: { refundTransaction: true; sourceSpendTransaction: true; sourceLot: true; targetLot: true };
}>;
type DebtRow = Prisma.MktPointsDebtGetPayload<{ include: { sourceTransaction: true } }>;

@Injectable()
export class PointsAssetQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  async getLots(query: PointsLotQueryDto) {
    const { skip, take, pageNum, pageSize } = this.resolvePage(query);
    const where = this.tenantHelper.readWhereForDelegate('mktPointsLot', {
      ...this.baseWhere(query, { includeRelatedId: false }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.sourceTransactionId ? { sourceTransactionId: query.sourceTransactionId } : {}),
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.relatedId ? { sourceTransaction: { is: { relatedId: query.relatedId } } } : {}),
    }) as Prisma.MktPointsLotWhereInput;

    const [rows, total] = await Promise.all([
      this.prisma.mktPointsLot.findMany({
        where,
        include: { sourceTransaction: true },
        orderBy: [{ createTime: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      this.prisma.mktPointsLot.count({ where }),
    ]);

    return Result.page(FormatDateFields(rows.map(row => this.toLotVo(row))), total, pageNum, pageSize);
  }

  async getFreezeAllocations(query: PointsFreezeAllocationQueryDto) {
    const { skip, take, pageNum, pageSize } = this.resolvePage(query);
    const where = this.tenantHelper.readWhereForDelegate('mktPointsFreezeAllocation', {
      ...this.baseWhere(query),
      ...(query.lotId ? { lotId: query.lotId } : {}),
      ...(query.freezeTransactionId ? { freezeTransactionId: query.freezeTransactionId } : {}),
      ...(query.releaseTransactionId ? { releaseTransactionId: query.releaseTransactionId } : {}),
      ...(query.status ? { status: query.status } : {}),
    }) as Prisma.MktPointsFreezeAllocationWhereInput;

    const [rows, total] = await Promise.all([
      this.prisma.mktPointsFreezeAllocation.findMany({
        where,
        include: { lot: true, freezeTransaction: true, releaseTransaction: true },
        orderBy: [{ createTime: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      this.prisma.mktPointsFreezeAllocation.count({ where }),
    ]);

    return Result.page(FormatDateFields(rows.map(row => this.toFreezeAllocationVo(row))), total, pageNum, pageSize);
  }

  async getConsumeAllocations(query: PointsConsumeAllocationQueryDto) {
    const { skip, take, pageNum, pageSize } = this.resolvePage(query);
    const where = this.tenantHelper.readWhereForDelegate('mktPointsConsumeAllocation', {
      ...this.baseWhere(query),
      ...(query.lotId ? { lotId: query.lotId } : {}),
      ...(query.spendTransactionId ? { spendTransactionId: query.spendTransactionId } : {}),
      ...(query.sourceFreezeAllocationId ? { sourceFreezeAllocationId: query.sourceFreezeAllocationId } : {}),
      ...(query.status ? { status: query.status } : {}),
    }) as Prisma.MktPointsConsumeAllocationWhereInput;

    const [rows, total] = await Promise.all([
      this.prisma.mktPointsConsumeAllocation.findMany({
        where,
        include: { lot: true, spendTransaction: true },
        orderBy: [{ createTime: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      this.prisma.mktPointsConsumeAllocation.count({ where }),
    ]);

    return Result.page(FormatDateFields(rows.map(row => this.toConsumeAllocationVo(row))), total, pageNum, pageSize);
  }

  async getRefundAllocations(query: PointsRefundAllocationQueryDto) {
    const { skip, take, pageNum, pageSize } = this.resolvePage(query);
    const where = this.tenantHelper.readWhereForDelegate('mktPointsRefundAllocation', {
      ...this.baseWhere(query),
      ...(query.refundTransactionId ? { refundTransactionId: query.refundTransactionId } : {}),
      ...(query.sourceSpendTransactionId ? { sourceSpendTransactionId: query.sourceSpendTransactionId } : {}),
      ...(query.sourceConsumeAllocationId ? { sourceConsumeAllocationId: query.sourceConsumeAllocationId } : {}),
      ...(query.sourceLotId ? { sourceLotId: query.sourceLotId } : {}),
      ...(query.targetLotId ? { targetLotId: query.targetLotId } : {}),
      ...(query.strategy ? { strategy: query.strategy } : {}),
    }) as Prisma.MktPointsRefundAllocationWhereInput;

    const [rows, total] = await Promise.all([
      this.prisma.mktPointsRefundAllocation.findMany({
        where,
        include: { refundTransaction: true, sourceSpendTransaction: true, sourceLot: true, targetLot: true },
        orderBy: [{ createTime: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      this.prisma.mktPointsRefundAllocation.count({ where }),
    ]);

    return Result.page(FormatDateFields(rows.map(row => this.toRefundAllocationVo(row))), total, pageNum, pageSize);
  }

  async getDebts(query: PointsDebtQueryDto) {
    const { skip, take, pageNum, pageSize } = this.resolvePage(query);
    const where = this.tenantHelper.readWhereForDelegate('mktPointsDebt', {
      ...this.baseWhere(query),
      ...(query.status ? { status: query.status } : {}),
      ...(query.reason ? { reason: query.reason } : {}),
      ...(query.sourceTransactionId ? { sourceTransactionId: query.sourceTransactionId } : {}),
    }) as Prisma.MktPointsDebtWhereInput;

    const [rows, total] = await Promise.all([
      this.prisma.mktPointsDebt.findMany({
        where,
        include: { sourceTransaction: true },
        orderBy: [{ createTime: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      this.prisma.mktPointsDebt.count({ where }),
    ]);

    return Result.page(FormatDateFields(rows.map(row => this.toDebtVo(row))), total, pageNum, pageSize);
  }

  private baseWhere(
    query:
      | PointsLotQueryDto
      | PointsFreezeAllocationQueryDto
      | PointsConsumeAllocationQueryDto
      | PointsRefundAllocationQueryDto
      | PointsDebtQueryDto,
    options: { includeRelatedId?: boolean } = {},
  ) {
    const includeRelatedId = options.includeRelatedId !== false;

    return {
      ...(query.memberId ? { memberId: query.memberId } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(includeRelatedId && query.relatedId ? { relatedId: query.relatedId } : {}),
      ...(query.startTime || query.endTime
        ? {
            createTime: {
              ...(query.startTime ? { gte: query.startTime } : {}),
              ...(query.endTime ? { lte: query.endTime } : {}),
            },
          }
        : {}),
    };
  }

  private resolvePage(query: PageInput) {
    const pageNum = Number(query.pageNum || 1);
    const pageSize = Math.min(Number(query.pageSize || 10), 100);

    return {
      pageNum,
      pageSize,
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    };
  }

  private toTransactionBrief(row: TransactionBriefSource | null): PointsAssetTransactionBriefVo | null {
    if (!row) return null;

    return {
      id: row.id,
      type: row.type,
      amount: row.amount,
      status: row.status,
      relatedId: row.relatedId,
      relatedType: row.relatedType,
      remark: row.remark,
      createTime: row.createTime,
    };
  }

  private toLotBrief(row: LotBriefSource): PointsAssetLotBriefVo {
    return {
      id: row.id,
      sourceTransactionId: row.sourceTransactionId,
      sourceType: row.sourceType,
      totalAmount: row.totalAmount,
      availableAmount: row.availableAmount,
      frozenAmount: row.frozenAmount,
      consumedAmount: row.consumedAmount,
      expiredAmount: row.expiredAmount,
      expireTime: row.expireTime,
      status: row.status,
    };
  }

  private toLotVo(row: LotRow): PointsLotVo {
    return {
      tenantId: row.tenantId,
      accountId: row.accountId,
      memberId: row.memberId,
      createTime: row.createTime,
      updateTime: row.updateTime,
      sourceTransaction: this.toTransactionBrief(row.sourceTransaction),
      ...this.toLotBrief(row),
    };
  }

  private toFreezeAllocationVo(row: FreezeAllocationRow): PointsFreezeAllocationVo {
    return {
      id: row.id,
      tenantId: row.tenantId,
      accountId: row.accountId,
      memberId: row.memberId,
      freezeTransactionId: row.freezeTransactionId,
      releaseTransactionId: row.releaseTransactionId,
      lotId: row.lotId,
      relatedId: row.relatedId,
      amount: row.amount,
      status: row.status,
      createTime: row.createTime,
      updateTime: row.updateTime,
      lot: this.toLotBrief(row.lot),
      freezeTransaction: this.toTransactionBrief(row.freezeTransaction) as PointsAssetTransactionBriefVo,
      releaseTransaction: this.toTransactionBrief(row.releaseTransaction),
    };
  }

  private toConsumeAllocationVo(row: ConsumeAllocationRow): PointsConsumeAllocationVo {
    return {
      id: row.id,
      tenantId: row.tenantId,
      accountId: row.accountId,
      memberId: row.memberId,
      spendTransactionId: row.spendTransactionId,
      sourceFreezeAllocationId: row.sourceFreezeAllocationId,
      lotId: row.lotId,
      relatedId: row.relatedId,
      amount: row.amount,
      refundableAmount: row.refundableAmount,
      status: row.status,
      createTime: row.createTime,
      updateTime: row.updateTime,
      lot: this.toLotBrief(row.lot),
      spendTransaction: this.toTransactionBrief(row.spendTransaction) as PointsAssetTransactionBriefVo,
    };
  }

  private toRefundAllocationVo(row: RefundAllocationRow): PointsRefundAllocationVo {
    return {
      id: row.id,
      tenantId: row.tenantId,
      accountId: row.accountId,
      memberId: row.memberId,
      refundTransactionId: row.refundTransactionId,
      sourceSpendTransactionId: row.sourceSpendTransactionId,
      sourceConsumeAllocationId: row.sourceConsumeAllocationId,
      sourceLotId: row.sourceLotId,
      targetLotId: row.targetLotId,
      relatedId: row.relatedId,
      amount: row.amount,
      strategy: row.strategy,
      createTime: row.createTime,
      refundTransaction: this.toTransactionBrief(row.refundTransaction) as PointsAssetTransactionBriefVo,
      sourceSpendTransaction: this.toTransactionBrief(row.sourceSpendTransaction),
      sourceLot: row.sourceLot ? this.toLotBrief(row.sourceLot) : null,
      targetLot: row.targetLot ? this.toLotBrief(row.targetLot) : null,
    };
  }

  private toDebtVo(row: DebtRow): PointsDebtVo {
    return {
      id: row.id,
      tenantId: row.tenantId,
      accountId: row.accountId,
      memberId: row.memberId,
      sourceTransactionId: row.sourceTransactionId,
      relatedId: row.relatedId,
      relatedType: row.relatedType,
      reason: row.reason,
      status: row.status,
      expectedAmount: row.expectedAmount,
      deductedAmount: row.deductedAmount,
      debtAmount: row.debtAmount,
      availableAtCreate: row.availableAtCreate,
      remark: row.remark,
      createTime: row.createTime,
      updateTime: row.updateTime,
      sourceTransaction: this.toTransactionBrief(row.sourceTransaction),
    };
  }
}

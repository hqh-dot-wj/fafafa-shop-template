import { Injectable } from '@nestjs/common';
import {
  MktPointsConsumeAllocation,
  MktPointsFreezeAllocation,
  MktPointsLot,
  PointsConsumeAllocationStatus,
  PointsFreezeAllocationStatus,
  PointsLotStatus,
  PointsRefundAllocationStrategy,
  PointsTransactionType,
  Prisma,
} from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { PrismaService } from 'src/prisma/prisma.service';
import { PointsErrorCode, PointsErrorMessages } from '../constants/error-codes';
import { PointsRuleService } from '../rule/rule.service';

interface PointsLotLedgerBaseInput {
  tenantId: string;
  accountId: string;
  memberId: string;
}

export interface CreatePointsLotInput extends PointsLotLedgerBaseInput {
  amount: number;
  sourceTransactionId: string;
  sourceType: PointsTransactionType;
  expireTime?: Date | null;
}

export interface AllocateFrozenPointsInput extends PointsLotLedgerBaseInput {
  amount: number;
  freezeTransactionId: string;
  relatedId?: string | null;
}

export interface ReleaseFrozenPointsInput extends PointsLotLedgerBaseInput {
  amount: number;
  relatedId: string;
  releaseTransactionId: string;
}

export interface ConsumePointsInput extends PointsLotLedgerBaseInput {
  amount: number;
  spendTransactionId: string;
  relatedId?: string | null;
}

export interface SettleFrozenPointsInput extends ConsumePointsInput {
  relatedId: string;
}

export interface RefundSpentPointsInput extends PointsLotLedgerBaseInput {
  amount: number;
  relatedId: string;
  refundTransactionId: string;
}

export interface RefundSpentPointsResult {
  strategy: PointsRefundAllocationStrategy;
  restoredAmount: number;
  compensatedAmount: number;
  fallbackAmount: number;
}

type MutableLotCounters = Pick<MktPointsLot, 'availableAmount' | 'frozenAmount' | 'consumedAmount'>;

@Injectable()
export class PointsLotLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly tenantHelper: TenantHelper,
    private readonly ruleService: PointsRuleService,
  ) {
    void this.cls;
  }

  @Transactional()
  async createLotForEarn(input: CreatePointsLotInput) {
    return this.prisma.mktPointsLot.create({
      data: {
        tenantId: input.tenantId,
        accountId: input.accountId,
        memberId: input.memberId,
        sourceTransactionId: input.sourceTransactionId,
        sourceType: input.sourceType,
        totalAmount: input.amount,
        availableAmount: input.amount,
        frozenAmount: 0,
        consumedAmount: 0,
        expiredAmount: 0,
        expireTime: input.expireTime ?? null,
        status: PointsLotStatus.ACTIVE,
      },
    });
  }

  @Transactional()
  async freezeLots(input: AllocateFrozenPointsInput) {
    const lots = await this.findAvailableLots(input);
    await this.allocateFromAvailableLots(lots, input.amount, async (lot, amount) => {
      await this.updateLotCounters(lot, {
        availableAmount: lot.availableAmount - amount,
        frozenAmount: lot.frozenAmount + amount,
        consumedAmount: lot.consumedAmount,
      });

      await this.prisma.mktPointsFreezeAllocation.create({
        data: {
          tenantId: input.tenantId,
          accountId: input.accountId,
          memberId: input.memberId,
          freezeTransactionId: input.freezeTransactionId,
          lotId: lot.id,
          relatedId: input.relatedId ?? null,
          amount,
          status: PointsFreezeAllocationStatus.ACTIVE,
        },
      });
    });
  }

  @Transactional()
  async releaseFrozenLots(input: ReleaseFrozenPointsInput) {
    const activeAllocations = await this.findActiveFreezeAllocations(input);

    if (activeAllocations.length > 0) {
      await this.releaseFreezeAllocations(activeAllocations, input.amount, input.releaseTransactionId);
      return;
    }

    await this.releaseLegacyFrozenLots(input);
  }

  @Transactional()
  async settleFrozenLots(input: SettleFrozenPointsInput) {
    const activeAllocations = await this.findActiveFreezeAllocations(input);

    if (activeAllocations.length > 0) {
      await this.consumeFreezeAllocations(activeAllocations, input.amount, input.spendTransactionId, input.relatedId);
      return;
    }

    await this.consumeLegacyFrozenLots(input);
  }

  @Transactional()
  async consumeAvailableLots(input: ConsumePointsInput) {
    const lots = await this.findAvailableLots(input);
    await this.allocateFromAvailableLots(lots, input.amount, async (lot, amount) => {
      await this.updateLotCounters(lot, {
        availableAmount: lot.availableAmount - amount,
        frozenAmount: lot.frozenAmount,
        consumedAmount: lot.consumedAmount + amount,
      });

      await this.createConsumeAllocation({
        ...input,
        lotId: lot.id,
        amount,
        sourceFreezeAllocationId: null,
      });
    });
  }

  @Transactional()
  async refundSpentLots(input: RefundSpentPointsInput): Promise<RefundSpentPointsResult> {
    const allocations = await this.prisma.mktPointsConsumeAllocation.findMany({
      where: this.tenantHelper.readWhereForDelegate('mktPointsConsumeAllocation', {
        tenantId: input.tenantId,
        accountId: input.accountId,
        memberId: input.memberId,
        relatedId: input.relatedId,
        refundableAmount: { gt: 0 },
        status: PointsConsumeAllocationStatus.ACTIVE,
      }) as Prisma.MktPointsConsumeAllocationWhereInput,
      include: { lot: true },
      orderBy: [{ createTime: 'asc' }, { id: 'asc' }],
    });

    let remaining = input.amount;
    let restoredAmount = 0;
    let compensatedAmount = 0;
    let fallbackAmount = 0;
    const now = new Date();
    // 退款补偿/兜底 lot 的 expireTime 一律按"当下租户规则"重新计算：
    // 已过期 lot 的 expireTime 不能继承（一继承新 lot 就一出生就过期）；
    // 未过期分支不新建 lot，原 lot 时间不变。
    const compensationExpireTime = await this.ruleService.resolveExpireTime(now);

    for (const allocation of allocations) {
      if (remaining <= 0) break;
      const amount = Math.min(allocation.refundableAmount, remaining);

      if (this.isExpired(allocation.lot, now)) {
        const targetLot = await this.createRefundCompensationLot(input, amount, compensationExpireTime);
        await this.createRefundAllocation(
          input,
          allocation,
          amount,
          PointsRefundAllocationStrategy.EXPIRED_LOT_COMPENSATION,
          targetLot.id,
        );
        compensatedAmount += amount;
      } else {
        await this.restoreOriginalLot(allocation.lot, amount);
        await this.createRefundAllocation(
          input,
          allocation,
          amount,
          PointsRefundAllocationStrategy.ORIGINAL_LOT_RESTORE,
          allocation.lotId,
        );
        restoredAmount += amount;
      }

      await this.markConsumeAllocationRefunded(allocation, amount);
      remaining -= amount;
    }

    if (remaining > 0) {
      const fallbackLot = await this.createRefundCompensationLot(input, remaining, compensationExpireTime);
      await this.prisma.mktPointsRefundAllocation.create({
        data: {
          tenantId: input.tenantId,
          accountId: input.accountId,
          memberId: input.memberId,
          refundTransactionId: input.refundTransactionId,
          relatedId: input.relatedId,
          targetLotId: fallbackLot.id,
          amount: remaining,
          strategy: PointsRefundAllocationStrategy.NEW_REFUND_TRANSACTION,
        },
      });
      fallbackAmount = remaining;
    }

    return {
      strategy: this.resolveRefundStrategy({ restoredAmount, compensatedAmount, fallbackAmount }),
      restoredAmount,
      compensatedAmount,
      fallbackAmount,
    };
  }

  @Transactional()
  async expireLot(lot: MktPointsLot, expireTransactionId: string) {
    await this.prisma.mktPointsLot.update({
      where: { id: lot.id },
      data: {
        availableAmount: 0,
        expiredAmount: { increment: lot.availableAmount },
        status: PointsLotStatus.EXPIRED,
      },
    });

    await this.prisma.mktPointsRefundAllocation.updateMany({
      where: {
        targetLotId: lot.id,
        refundTransactionId: expireTransactionId,
      },
      data: {
        strategy: PointsRefundAllocationStrategy.MANUAL_REVIEW,
      },
    });
  }

  async getExpiringPoints(memberId: string, days: number): Promise<number> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const result = await this.prisma.mktPointsLot.aggregate({
      where: this.tenantHelper.readWhereForDelegate('mktPointsLot', {
        memberId,
        availableAmount: { gt: 0 },
        status: PointsLotStatus.ACTIVE,
        expireTime: {
          gte: now,
          lte: futureDate,
        },
      }) as Prisma.MktPointsLotWhereInput,
      _sum: {
        availableAmount: true,
      },
    });

    return result._sum.availableAmount || 0;
  }

  private async findAvailableLots(input: PointsLotLedgerBaseInput) {
    const now = new Date();

    return this.prisma.mktPointsLot.findMany({
      where: this.tenantHelper.readWhereForDelegate('mktPointsLot', {
        tenantId: input.tenantId,
        accountId: input.accountId,
        memberId: input.memberId,
        availableAmount: { gt: 0 },
        status: PointsLotStatus.ACTIVE,
        OR: [{ expireTime: null }, { expireTime: { gt: now } }],
      }) as Prisma.MktPointsLotWhereInput,
      orderBy: [{ expireTime: { sort: 'asc', nulls: 'last' } }, { createTime: 'asc' }, { id: 'asc' }],
    });
  }

  private async allocateFromAvailableLots(
    lots: MktPointsLot[],
    amount: number,
    allocate: (lot: MktPointsLot, amount: number) => Promise<void>,
  ) {
    let remaining = amount;

    for (const lot of lots) {
      if (remaining <= 0) break;
      const allocatedAmount = Math.min(lot.availableAmount, remaining);
      await allocate(lot, allocatedAmount);
      remaining -= allocatedAmount;
    }

    if (remaining > 0) {
      BusinessException.throw(400, PointsErrorMessages[PointsErrorCode.INSUFFICIENT_BALANCE]);
    }
  }

  private async findActiveFreezeAllocations(
    input: Pick<SettleFrozenPointsInput, 'tenantId' | 'accountId' | 'memberId' | 'relatedId'>,
  ) {
    return this.prisma.mktPointsFreezeAllocation.findMany({
      where: this.tenantHelper.readWhereForDelegate('mktPointsFreezeAllocation', {
        tenantId: input.tenantId,
        accountId: input.accountId,
        memberId: input.memberId,
        relatedId: input.relatedId,
        status: PointsFreezeAllocationStatus.ACTIVE,
      }) as Prisma.MktPointsFreezeAllocationWhereInput,
      include: { lot: true },
      orderBy: [{ createTime: 'asc' }, { id: 'asc' }],
    });
  }

  private async releaseFreezeAllocations(
    allocations: Array<MktPointsFreezeAllocation & { lot: MktPointsLot }>,
    amount: number,
    releaseTransactionId: string,
  ) {
    let remaining = amount;

    for (const allocation of allocations) {
      if (remaining <= 0) break;
      const allocatedAmount = Math.min(allocation.amount, remaining);

      await this.prisma.mktPointsLot.update({
        where: { id: allocation.lotId },
        data: {
          availableAmount: { increment: allocatedAmount },
          frozenAmount: { decrement: allocatedAmount },
          status: PointsLotStatus.ACTIVE,
        },
      });

      await this.prisma.mktPointsFreezeAllocation.update({
        where: { id: allocation.id },
        data: this.resolveFreezeAllocationProgress(allocation.amount, allocatedAmount, {
          status: PointsFreezeAllocationStatus.RELEASED,
          releaseTransactionId,
        }),
      });

      remaining -= allocatedAmount;
    }

    if (remaining > 0) {
      BusinessException.throw(400, PointsErrorMessages[PointsErrorCode.INSUFFICIENT_FROZEN]);
    }
  }

  private async releaseLegacyFrozenLots(input: ReleaseFrozenPointsInput) {
    const lots = await this.findFrozenLots(input);
    let remaining = input.amount;

    for (const lot of lots) {
      if (remaining <= 0) break;
      const amount = Math.min(lot.frozenAmount, remaining);
      await this.prisma.mktPointsLot.update({
        where: { id: lot.id },
        data: {
          availableAmount: { increment: amount },
          frozenAmount: { decrement: amount },
          status: PointsLotStatus.ACTIVE,
        },
      });
      remaining -= amount;
    }

    if (remaining > 0) {
      BusinessException.throw(400, PointsErrorMessages[PointsErrorCode.INSUFFICIENT_FROZEN]);
    }
  }

  private async consumeFreezeAllocations(
    allocations: Array<MktPointsFreezeAllocation & { lot: MktPointsLot }>,
    amount: number,
    spendTransactionId: string,
    relatedId: string,
  ) {
    let remaining = amount;

    for (const allocation of allocations) {
      if (remaining <= 0) break;
      const allocatedAmount = Math.min(allocation.amount, remaining);

      await this.prisma.mktPointsLot.update({
        where: { id: allocation.lotId },
        data: {
          frozenAmount: { decrement: allocatedAmount },
          consumedAmount: { increment: allocatedAmount },
          status: this.resolveLotStatus({
            availableAmount: allocation.lot.availableAmount,
            frozenAmount: allocation.lot.frozenAmount - allocatedAmount,
            consumedAmount: allocation.lot.consumedAmount + allocatedAmount,
          }),
        },
      });

      await this.createConsumeAllocation({
        tenantId: allocation.tenantId,
        accountId: allocation.accountId,
        memberId: allocation.memberId,
        amount: allocatedAmount,
        spendTransactionId,
        relatedId,
        lotId: allocation.lotId,
        sourceFreezeAllocationId: allocation.id,
      });

      await this.prisma.mktPointsFreezeAllocation.update({
        where: { id: allocation.id },
        data: this.resolveFreezeAllocationProgress(allocation.amount, allocatedAmount, {
          status: PointsFreezeAllocationStatus.CONSUMED,
        }),
      });

      remaining -= allocatedAmount;
    }

    if (remaining > 0) {
      BusinessException.throw(400, PointsErrorMessages[PointsErrorCode.INSUFFICIENT_FROZEN]);
    }
  }

  private async consumeLegacyFrozenLots(input: SettleFrozenPointsInput) {
    const lots = await this.findFrozenLots(input);
    let remaining = input.amount;

    for (const lot of lots) {
      if (remaining <= 0) break;
      const amount = Math.min(lot.frozenAmount, remaining);
      await this.prisma.mktPointsLot.update({
        where: { id: lot.id },
        data: {
          frozenAmount: { decrement: amount },
          consumedAmount: { increment: amount },
          status: this.resolveLotStatus({
            availableAmount: lot.availableAmount,
            frozenAmount: lot.frozenAmount - amount,
            consumedAmount: lot.consumedAmount + amount,
          }),
        },
      });
      await this.createConsumeAllocation({
        ...input,
        lotId: lot.id,
        amount,
        sourceFreezeAllocationId: null,
      });
      remaining -= amount;
    }

    if (remaining > 0) {
      BusinessException.throw(400, PointsErrorMessages[PointsErrorCode.INSUFFICIENT_FROZEN]);
    }
  }

  private async findFrozenLots(input: PointsLotLedgerBaseInput) {
    return this.prisma.mktPointsLot.findMany({
      where: this.tenantHelper.readWhereForDelegate('mktPointsLot', {
        tenantId: input.tenantId,
        accountId: input.accountId,
        memberId: input.memberId,
        frozenAmount: { gt: 0 },
        status: PointsLotStatus.ACTIVE,
      }) as Prisma.MktPointsLotWhereInput,
      orderBy: [{ expireTime: { sort: 'asc', nulls: 'last' } }, { createTime: 'asc' }, { id: 'asc' }],
    });
  }

  private resolveFreezeAllocationProgress(
    allocationAmount: number,
    allocatedAmount: number,
    closedData: Prisma.MktPointsFreezeAllocationUncheckedUpdateInput,
  ): Prisma.MktPointsFreezeAllocationUncheckedUpdateInput {
    // ACTIVE 分摊的 amount 表示剩余冻结量，直到全量释放或结算才关闭。
    if (allocatedAmount >= allocationAmount) {
      return closedData;
    }
    return { amount: allocationAmount - allocatedAmount };
  }

  private async updateLotCounters(lot: MktPointsLot, counters: MutableLotCounters) {
    await this.prisma.mktPointsLot.update({
      where: { id: lot.id },
      data: {
        availableAmount: counters.availableAmount,
        frozenAmount: counters.frozenAmount,
        consumedAmount: counters.consumedAmount,
        status: this.resolveLotStatus(counters),
      },
    });
  }

  private async createConsumeAllocation(
    input: ConsumePointsInput & {
      lotId: string;
      sourceFreezeAllocationId: string | null;
    },
  ) {
    await this.prisma.mktPointsConsumeAllocation.create({
      data: {
        tenantId: input.tenantId,
        accountId: input.accountId,
        memberId: input.memberId,
        spendTransactionId: input.spendTransactionId,
        sourceFreezeAllocationId: input.sourceFreezeAllocationId,
        lotId: input.lotId,
        relatedId: input.relatedId ?? null,
        amount: input.amount,
        refundableAmount: input.amount,
        status: PointsConsumeAllocationStatus.ACTIVE,
      },
    });
  }

  private async restoreOriginalLot(lot: MktPointsLot, amount: number) {
    await this.prisma.mktPointsLot.update({
      where: { id: lot.id },
      data: {
        availableAmount: { increment: amount },
        consumedAmount: { decrement: amount },
        status: PointsLotStatus.ACTIVE,
      },
    });
  }

  private async createRefundCompensationLot(input: RefundSpentPointsInput, amount: number, expireTime: Date | null) {
    return this.prisma.mktPointsLot.create({
      data: {
        tenantId: input.tenantId,
        accountId: input.accountId,
        memberId: input.memberId,
        sourceTransactionId: input.refundTransactionId,
        sourceType: PointsTransactionType.REFUND,
        totalAmount: amount,
        availableAmount: amount,
        frozenAmount: 0,
        consumedAmount: 0,
        expiredAmount: 0,
        expireTime,
        status: PointsLotStatus.ACTIVE,
      },
    });
  }

  private async createRefundAllocation(
    input: RefundSpentPointsInput,
    allocation: MktPointsConsumeAllocation & { lot: MktPointsLot },
    amount: number,
    strategy: PointsRefundAllocationStrategy,
    targetLotId: string,
  ) {
    await this.prisma.mktPointsRefundAllocation.create({
      data: {
        tenantId: input.tenantId,
        accountId: input.accountId,
        memberId: input.memberId,
        refundTransactionId: input.refundTransactionId,
        sourceSpendTransactionId: allocation.spendTransactionId,
        sourceConsumeAllocationId: allocation.id,
        sourceLotId: allocation.lotId,
        targetLotId,
        relatedId: input.relatedId,
        amount,
        strategy,
      },
    });
  }

  private async markConsumeAllocationRefunded(allocation: MktPointsConsumeAllocation, amount: number) {
    const nextRefundableAmount = allocation.refundableAmount - amount;
    await this.prisma.mktPointsConsumeAllocation.update({
      where: { id: allocation.id },
      data: {
        refundableAmount: nextRefundableAmount,
        status:
          nextRefundableAmount <= 0 ? PointsConsumeAllocationStatus.REFUNDED : PointsConsumeAllocationStatus.ACTIVE,
      },
    });
  }

  private resolveLotStatus(counters: MutableLotCounters) {
    return counters.availableAmount <= 0 && counters.frozenAmount <= 0
      ? PointsLotStatus.EXHAUSTED
      : PointsLotStatus.ACTIVE;
  }

  private resolveRefundStrategy(input: {
    restoredAmount: number;
    compensatedAmount: number;
    fallbackAmount: number;
  }): PointsRefundAllocationStrategy {
    if (input.fallbackAmount > 0) return PointsRefundAllocationStrategy.NEW_REFUND_TRANSACTION;
    if (input.compensatedAmount > 0) return PointsRefundAllocationStrategy.EXPIRED_LOT_COMPENSATION;
    return PointsRefundAllocationStrategy.ORIGINAL_LOT_RESTORE;
  }

  private isExpired(lot: MktPointsLot, now: Date) {
    return Boolean(lot.expireTime && lot.expireTime <= now);
  }
}

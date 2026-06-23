import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseRepository } from 'src/common/repository';
import { FinWithdrawal, Prisma, WithdrawalStatus } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class WithdrawalRepository extends BaseRepository<
  FinWithdrawal,
  Prisma.FinWithdrawalCreateInput,
  Prisma.FinWithdrawalUpdateInput
> {
  constructor(prisma: PrismaService, cls: ClsService) {
    super(prisma, cls, 'finWithdrawal');
  }

  /**
   * 聚合提现数据（读路径合并租户与软删等 scope）
   */
  async aggregate(args: Prisma.FinWithdrawalAggregateArgs) {
    const where = this.scopeReadWhere((args.where ?? {}) as object) as Prisma.FinWithdrawalWhereInput;
    return this.prisma.finWithdrawal.aggregate({ ...args, where });
  }

  async updateStatusIfCurrent(id: string, currentStatus: WithdrawalStatus, data: Prisma.FinWithdrawalUpdateInput) {
    const result = await this.updateMany({ id, status: currentStatus }, data);
    return result.count;
  }

  async claimPendingForApproval(id: string, auditBy: string, paymentNo?: string) {
    return this.updateStatusIfCurrent(id, WithdrawalStatus.PENDING, {
      status: WithdrawalStatus.PROCESSING,
      auditTime: new Date(),
      auditBy,
      failReason: null,
      ...(paymentNo ? { paymentNo } : {}),
    });
  }

  async claimFailedForRetry(id: string, maxRetryCount: number, paymentNo?: string) {
    const result = await this.updateMany(
      {
        id,
        status: WithdrawalStatus.FAILED,
        retryCount: { lt: maxRetryCount },
      },
      {
        status: WithdrawalStatus.PROCESSING,
        retryCount: { increment: 1 },
        failReason: null,
        ...(paymentNo ? { paymentNo } : {}),
      },
    );
    return result.count;
  }
}

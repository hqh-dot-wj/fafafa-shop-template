import { FinCommission, Prisma } from '@prisma/client';
import { QueryOptions } from 'src/common/repository/base.repository';
import { IPaginatedData } from 'src/common/response/response.interface';

export abstract class CommissionQueryPort {
  abstract aggregate(
    args: Prisma.FinCommissionAggregateArgs,
  ): Promise<Prisma.GetFinCommissionAggregateType<Prisma.FinCommissionAggregateArgs>>;

  abstract findMany(args?: Record<string, unknown>): Promise<FinCommission[]>;

  abstract findPage(options: QueryOptions): Promise<IPaginatedData<FinCommission>>;
}

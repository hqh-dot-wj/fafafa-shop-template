import { FinWithdrawal, Prisma } from '@prisma/client';
import { QueryOptions } from 'src/common/repository/base.repository';
import { IPaginatedData } from 'src/common/response/response.interface';
import { WithdrawalRepository } from '../withdrawal/withdrawal.repository';

export abstract class WithdrawalQueryPort {
  abstract count(where?: object): Promise<number>;

  abstract aggregate(args: Prisma.FinWithdrawalAggregateArgs): ReturnType<WithdrawalRepository['aggregate']>;

  abstract findMany(args?: Record<string, unknown>): Promise<FinWithdrawal[]>;

  abstract findPage(options: QueryOptions): Promise<IPaginatedData<FinWithdrawal>>;
}

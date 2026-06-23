import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { QueryOptions } from 'src/common/repository/base.repository';
import { WithdrawalRepository } from '../withdrawal/withdrawal.repository';
import { WithdrawalQueryPort } from '../ports/withdrawal-query.port';

@Injectable()
export class WithdrawalQueryAdapter extends WithdrawalQueryPort {
  constructor(private readonly withdrawalRepo: WithdrawalRepository) {
    super();
  }

  count(where?: object) {
    return this.withdrawalRepo.count(where);
  }

  aggregate(args: Prisma.FinWithdrawalAggregateArgs) {
    return this.withdrawalRepo.aggregate(args);
  }

  findMany(args?: Record<string, unknown>) {
    return this.withdrawalRepo.findMany(args);
  }

  findPage(options: QueryOptions) {
    return this.withdrawalRepo.findPage(options);
  }
}

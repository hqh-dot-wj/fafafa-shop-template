import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { QueryOptions } from 'src/common/repository/base.repository';
import { CommissionRepository } from '../commission/commission.repository';
import { CommissionQueryPort } from '../ports/commission-query.port';

@Injectable()
export class CommissionQueryAdapter extends CommissionQueryPort {
  constructor(private readonly commissionRepo: CommissionRepository) {
    super();
  }

  aggregate(args: Prisma.FinCommissionAggregateArgs) {
    return this.commissionRepo.aggregate(args);
  }

  findMany(args?: Record<string, unknown>) {
    return this.commissionRepo.findMany(args);
  }

  findPage(options: QueryOptions) {
    return this.commissionRepo.findPage(options);
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WalletQueryPort, WalletTransactionPageQuery } from '../ports/wallet-query.port';
import { TransactionRepository } from '../wallet/transaction.repository';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class WalletQueryAdapter extends WalletQueryPort {
  constructor(
    private readonly walletService: WalletService,
    private readonly transactionRepo: TransactionRepository,
  ) {
    super();
  }

  findByMemberId(memberId: string) {
    return this.walletService.getWallet(memberId);
  }

  async findTransactionsPage(memberId: string, query: WalletTransactionPageQuery) {
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 20;
    const wallet = await this.walletService.getWallet(memberId);
    if (!wallet) {
      return {
        rows: [],
        total: 0,
        pageNum,
        pageSize,
        pages: 0,
      };
    }

    const where: Prisma.FinTransactionWhereInput = {
      walletId: wallet.id,
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    return this.transactionRepo.findPage({
      pageNum,
      pageSize,
      where,
      orderBy: 'createTime',
      order: 'desc',
    });
  }
}

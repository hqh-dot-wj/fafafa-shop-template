import { FinTransaction, FinWallet, TransType } from '@prisma/client';
import { IPaginatedData } from 'src/common/response/response.interface';

export interface WalletTransactionPageQuery {
  tenantId?: string;
  type?: TransType;
  pageNum?: number;
  pageSize?: number;
}

export abstract class WalletQueryPort {
  abstract findByMemberId(memberId: string): Promise<FinWallet | null>;

  abstract findTransactionsPage(
    memberId: string,
    query: WalletTransactionPageQuery,
  ): Promise<IPaginatedData<FinTransaction>>;
}

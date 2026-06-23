import { PrismaClient, TransType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { HUNAN_FULL_MEMBERS } from '../hunan-full/catalog-members';
import { assertHunanFullSeedScope, HUNAN_FULL_TENANT_ID, hunanFullAt } from '../hunan-full/shared';

const HF_WALLET_RELATED_PREFIX = 'HF-WALLET::';

/**
 * 为湖南演示会员补齐 fin_transaction，使钱包余额与流水可对账（幂等：按 relatedId 跳过）。
 */
export async function seedHunanMemberLedger(prisma: PrismaClient): Promise<void> {
  await assertHunanFullSeedScope(prisma, 'seedHunanMemberLedger');
  console.log('[05-CEnd] 湖南完整演示钱包流水...');

  let created = 0;

  for (const member of HUNAN_FULL_MEMBERS) {
    if (member.walletIncome <= 0 && member.walletBalance <= 0) {
      continue;
    }

    const wallet = await prisma.finWallet.findUnique({
      where: { memberId: member.memberId },
      select: { id: true, balance: true, totalIncome: true },
    });
    if (!wallet) {
      continue;
    }

    const incomeRelatedId = `${HF_WALLET_RELATED_PREFIX}${member.memberId}::COMMISSION_IN`;
    const incomeExists = await prisma.finTransaction.findFirst({
      where: { walletId: wallet.id, relatedId: incomeRelatedId },
    });

    if (!incomeExists && member.walletIncome > 0) {
      const incomeAmount = new Decimal(member.walletIncome);
      const balanceAfterIncome = incomeAmount;

      await prisma.finTransaction.create({
        data: {
          walletId: wallet.id,
          tenantId: HUNAN_FULL_TENANT_ID,
          type: TransType.COMMISSION_IN,
          amount: incomeAmount,
          balanceAfter: balanceAfterIncome,
          relatedId: incomeRelatedId,
          remark: '演示佣金累计入账',
          createTime: hunanFullAt(-40),
        },
      });
      created += 1;
    }

    const withdrawRelatedId = `${HF_WALLET_RELATED_PREFIX}${member.memberId}::WITHDRAW_OUT`;
    const withdrawExists = await prisma.finTransaction.findFirst({
      where: { walletId: wallet.id, relatedId: withdrawRelatedId },
    });

    const withdrawn = new Decimal(member.walletIncome).minus(new Decimal(member.walletBalance));
    if (!withdrawExists && withdrawn.gt(0)) {
      await prisma.finTransaction.create({
        data: {
          walletId: wallet.id,
          tenantId: HUNAN_FULL_TENANT_ID,
          type: TransType.WITHDRAW_OUT,
          amount: withdrawn.negated(),
          balanceAfter: new Decimal(member.walletBalance),
          relatedId: withdrawRelatedId,
          remark: '演示提现出账',
          createTime: hunanFullAt(-8),
        },
      });
      created += 1;
    }
  }

  console.log(`  ✓ 钱包流水 ${created} 条（已存在同 relatedId 则跳过）`);
}

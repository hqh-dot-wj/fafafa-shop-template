/**
 * 为少量会员写入与账户余额一致的演示流水（幂等：按 relatedId 去重）
 */
import { PrismaClient, PointsTransactionStatus, PointsTransactionType, TransType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { DEMO_TENANT_IDS } from '../03-tenants/sync-demo-tenant-permissions';

const DEMO_RELATED = 'seed:member-ledger-demo';
/** 与 members.ts 默认租户一致 */
const SEED_TENANT_IDS = DEMO_TENANT_IDS;
const DEMO_COUNT_PER_TENANT = 2;

const WALLET_AMOUNTS = [new Decimal('36.50'), new Decimal('12.00')] as const;
const POINTS_AMOUNTS = [100, 60] as const;

export async function seedMemberLedgerDemo(prisma: PrismaClient) {
  console.log('[05-CEnd] 会员演示流水（钱包/积分）...');

  for (const tenantId of SEED_TENANT_IDS) {
    const members = await prisma.umsMember.findMany({
      where: { tenantId },
      select: { memberId: true },
      orderBy: { memberId: 'asc' },
      take: DEMO_COUNT_PER_TENANT,
    });

    for (let i = 0; i < members.length; i++) {
      const { memberId } = members[i]!;
      const walletAmount = WALLET_AMOUNTS[i] ?? WALLET_AMOUNTS[0]!;
      const pointsAmount = POINTS_AMOUNTS[i] ?? POINTS_AMOUNTS[0]!;

      await seedWalletDemo(prisma, tenantId, memberId, walletAmount, i);
      await seedPointsDemo(prisma, tenantId, memberId, pointsAmount, i);
    }
  }

  console.log('  ✓ 演示流水（若已存在同 relatedId 则跳过）');
}

async function seedWalletDemo(
  prisma: PrismaClient,
  tenantId: string,
  memberId: string,
  amount: Decimal,
  index: number,
) {
  const wallet = await prisma.finWallet.findUnique({
    where: { memberId },
    select: { id: true },
  });
  if (!wallet) {
    return;
  }

  const relatedId = `${DEMO_RELATED}:wallet:${memberId}`;
  const existed = await prisma.finTransaction.findFirst({
    where: { walletId: wallet.id, relatedId },
  });
  if (existed) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.finWallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: amount },
        version: { increment: 1 },
      },
    });

    await tx.finTransaction.create({
      data: {
        walletId: wallet.id,
        tenantId,
        type: TransType.RECHARGE_IN,
        amount,
        balanceAfter: updated.balance,
        relatedId,
        remark: index === 0 ? '种子数据：演示充值入账' : '种子数据：演示充值入账（次卡）',
      },
    });
  });
}

async function seedPointsDemo(prisma: PrismaClient, tenantId: string, memberId: string, points: number, index: number) {
  const account = await prisma.mktPointsAccount.findUnique({
    where: { tenantId_memberId: { tenantId, memberId } },
    select: { id: true, availablePoints: true },
  });
  if (!account) {
    return;
  }

  const relatedId = `${DEMO_RELATED}:points:${memberId}`;
  const existed = await prisma.mktPointsTransaction.findFirst({
    where: { accountId: account.id, relatedId },
  });
  if (existed) {
    return;
  }

  const balanceBefore = account.availablePoints;
  const balanceAfter = balanceBefore + points;

  await prisma.$transaction(async (tx) => {
    await tx.mktPointsAccount.update({
      where: { id: account.id },
      data: {
        totalPoints: { increment: points },
        availablePoints: { increment: points },
        version: { increment: 1 },
      },
    });

    await tx.mktPointsTransaction.create({
      data: {
        tenantId,
        accountId: account.id,
        memberId,
        type: PointsTransactionType.EARN_ADMIN,
        amount: points,
        balanceBefore,
        balanceAfter,
        relatedId,
        relatedType: 'SEED',
        status: PointsTransactionStatus.COMPLETED,
        remark: index === 0 ? '种子数据：演示积分发放' : '种子数据：演示积分发放（次卡）',
      },
    });
  });
}

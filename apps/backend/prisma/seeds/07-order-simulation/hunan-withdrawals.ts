import { PrismaClient, WithdrawalStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { HUNAN_FULL_MEMBERS } from '../hunan-full/catalog-members';
import { assertHunanFullSeedScope, hunanFullAt, HUNAN_FULL_TENANT_ID } from '../hunan-full/shared';

type SeedWithdrawal = {
  id: string;
  memberId: string;
  method: 'WECHAT_WALLET' | 'BANK_CARD';
  amount: number;
  fee: number;
  status: WithdrawalStatus;
  createTime: Date;
  auditTime: Date | null;
  auditBy: string | null;
  auditRemark: string | null;
  paymentNo: string | null;
  failReason: string | null;
  retryCount: number;
  accountNo: string | null;
};

const memberIds = HUNAN_FULL_MEMBERS.slice(0, 6).map(member => member.memberId);

const WITHDRAWALS: SeedWithdrawal[] = [
  {
    id: 'hf-wd-001',
    memberId: memberIds[0]!,
    method: 'WECHAT_WALLET',
    amount: 120,
    fee: 2,
    status: WithdrawalStatus.PENDING,
    createTime: hunanFullAt(-1, 11, 15),
    auditTime: null,
    auditBy: null,
    auditRemark: null,
    paymentNo: null,
    failReason: null,
    retryCount: 0,
    accountNo: null,
  },
  {
    id: 'hf-wd-002',
    memberId: memberIds[1]!,
    method: 'WECHAT_WALLET',
    amount: 88,
    fee: 1,
    status: WithdrawalStatus.PROCESSING,
    createTime: hunanFullAt(-2, 15, 20),
    auditTime: hunanFullAt(-2, 16, 0),
    auditBy: 'finance.auditor',
    auditRemark: '演示：微信零钱打款已受理，等待回单',
    paymentNo: 'HFWDBAT0002:HFWDDET0002',
    failReason: null,
    retryCount: 0,
    accountNo: null,
  },
  {
    id: 'hf-wd-003',
    memberId: memberIds[2]!,
    method: 'BANK_CARD',
    amount: 260,
    fee: 4,
    status: WithdrawalStatus.APPROVED,
    createTime: hunanFullAt(-3, 10, 30),
    auditTime: hunanFullAt(-3, 12, 10),
    auditBy: 'finance.auditor',
    auditRemark: '演示：银行卡人工打款已完成',
    paymentNo: 'BANK_MANUAL_hf-wd-003',
    failReason: null,
    retryCount: 0,
    accountNo: '622202******1024',
  },
  {
    id: 'hf-wd-004',
    memberId: memberIds[3]!,
    method: 'BANK_CARD',
    amount: 150,
    fee: 2,
    status: WithdrawalStatus.REJECTED,
    createTime: hunanFullAt(-4, 9, 40),
    auditTime: hunanFullAt(-4, 10, 10),
    auditBy: 'risk.auditor',
    auditRemark: '演示：结算账户姓名与实名不一致',
    paymentNo: null,
    failReason: null,
    retryCount: 0,
    accountNo: '622848******2048',
  },
  {
    id: 'hf-wd-005',
    memberId: memberIds[4]!,
    method: 'WECHAT_WALLET',
    amount: 96,
    fee: 1,
    status: WithdrawalStatus.FAILED,
    createTime: hunanFullAt(-5, 14, 5),
    auditTime: hunanFullAt(-5, 14, 35),
    auditBy: 'finance.auditor',
    auditRemark: '演示：通道失败待重试',
    paymentNo: 'HFWDBAT0005:HFWDDET0005',
    failReason: '演示：微信转账状态超时未确认',
    retryCount: 1,
    accountNo: null,
  },
  {
    id: 'hf-wd-006',
    memberId: memberIds[5]!,
    method: 'WECHAT_WALLET',
    amount: 72,
    fee: 1,
    status: WithdrawalStatus.APPROVED,
    createTime: hunanFullAt(-6, 16, 45),
    auditTime: hunanFullAt(-6, 17, 5),
    auditBy: 'finance.auditor',
    auditRemark: '演示：微信零钱已到账',
    paymentNo: 'HFWDBAT0006:HFWDDET0006',
    failReason: null,
    retryCount: 0,
    accountNo: null,
  },
];

export async function seedHunanWithdrawals(prisma: PrismaClient): Promise<void> {
  await assertHunanFullSeedScope(prisma, 'seedHunanWithdrawals');
  console.log('[07-Orders] 湖南完整演示提现...');

  const memberMap = new Map(HUNAN_FULL_MEMBERS.map(member => [member.memberId, member]));

  await prisma.finWithdrawal.deleteMany({
    where: {
      id: {
        in: WITHDRAWALS.map(item => item.id),
      },
    },
  });

  await prisma.finWithdrawal.createMany({
    data: WITHDRAWALS.map(item => {
      const member = memberMap.get(item.memberId);
      const actualAmount = new Decimal(Math.max(item.amount - item.fee, 0));

      return {
        id: item.id,
        tenantId: HUNAN_FULL_TENANT_ID,
        memberId: item.memberId,
        amount: new Decimal(item.amount),
        fee: new Decimal(item.fee),
        actualAmount,
        method: item.method,
        accountNo: item.accountNo,
        realName: member?.nickname ?? '湖南演示用户',
        status: item.status,
        retryCount: item.retryCount,
        auditTime: item.auditTime,
        auditBy: item.auditBy,
        auditRemark: item.auditRemark,
        paymentNo: item.paymentNo,
        failReason: item.failReason,
        createTime: item.createTime,
      };
    }),
  });

  console.log(`  ✓ ${WITHDRAWALS.length} 条提现样本（含待审核/处理中/成功/驳回/失败）`);
}

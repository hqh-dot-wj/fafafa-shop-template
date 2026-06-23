import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { BusinessException } from 'src/common/exceptions';
import { TenantHelper } from 'src/common/tenant/tenant.helper';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  async info(userId: string) {
    const user = await this.prisma.umsMember.findUnique({
      where: { memberId: userId },
    });

    BusinessException.throwIfNull(user, '用户不存在');

    const [wallet, pointsAccount] = await Promise.all([
      this.prisma.finWallet.findFirst({
        where: this.tenantHelper.readWhereForDelegate('finWallet', {
          memberId: userId,
          tenantId: user.tenantId,
        }) as Prisma.FinWalletWhereInput,
        select: { balance: true, frozen: true },
      }),
      this.prisma.mktPointsAccount.findFirst({
        where: this.tenantHelper.readWhereForDelegate('mktPointsAccount', {
          tenantId: user.tenantId,
          memberId: userId,
        }) as Prisma.MktPointsAccountWhereInput,
        select: { availablePoints: true },
      }),
    ]);

    return {
      ...user,
      levelId: user.levelId || 0,
      balance: wallet ? Number(wallet.balance) : 0,
      frozenBalance: wallet ? Number(wallet.frozen) : 0,
      points: pointsAccount?.availablePoints ?? 0,
    };
  }
}

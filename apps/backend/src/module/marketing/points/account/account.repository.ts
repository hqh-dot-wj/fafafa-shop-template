import { Injectable } from '@nestjs/common';
import { MktPointsAccount, Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { BaseRepository } from 'src/common/repository/base.repository';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { PrismaService } from 'src/prisma/prisma.service';

export interface AtomicPointsMutationResult {
  id: string;
  balanceBefore: number;
  balanceAfter: number;
}

type AtomicPointsMutationRow = {
  id: string;
  balance_before: number;
  balance_after: number;
};

/**
 * 积分账户仓储
 *
 * @description 继承 BaseRepository，自动处理租户隔离
 */
@Injectable()
export class PointsAccountRepository extends BaseRepository<
  MktPointsAccount,
  Prisma.MktPointsAccountCreateInput,
  Prisma.MktPointsAccountUpdateInput
> {
  constructor(prisma: PrismaService, cls: ClsService) {
    super(prisma, cls, 'mktPointsAccount', 'id', 'tenantId');
  }

  /**
   * 根据用户ID查询积分账户
   *
   * @param memberId 用户ID
   * @returns 积分账户
   */
  async findByMemberId(memberId: string): Promise<MktPointsAccount | null> {
    return this.findOne({ memberId });
  }

  async atomicAdd(
    accountId: string,
    amount: number,
    tenantId = this.resolveTenantId(),
  ): Promise<AtomicPointsMutationResult | null> {
    const rows = await this.client.$queryRaw<AtomicPointsMutationRow[]>`
      UPDATE "mkt_points_account"
      SET
        "total_points" = "total_points" + ${amount},
        "available_points" = "available_points" + ${amount},
        "version" = "version" + 1,
        "update_time" = NOW()
      WHERE "id" = ${accountId}
        AND "tenant_id" = ${tenantId}
      RETURNING
        "id",
        ("available_points" - ${amount})::int AS "balance_before",
        "available_points"::int AS "balance_after"
    `;

    return this.mapAtomicMutation(rows);
  }

  async atomicDeduct(
    memberId: string,
    amount: number,
    tenantId = this.resolveTenantId(),
  ): Promise<AtomicPointsMutationResult | null> {
    const rows = await this.client.$queryRaw<AtomicPointsMutationRow[]>`
      UPDATE "mkt_points_account"
      SET
        "available_points" = "available_points" - ${amount},
        "used_points" = "used_points" + ${amount},
        "version" = "version" + 1,
        "update_time" = NOW()
      WHERE "member_id" = ${memberId}
        AND "tenant_id" = ${tenantId}
        AND "available_points" >= ${amount}
      RETURNING
        "id",
        ("available_points" + ${amount})::int AS "balance_before",
        "available_points"::int AS "balance_after"
    `;

    return this.mapAtomicMutation(rows);
  }

  async atomicFreeze(
    memberId: string,
    amount: number,
    tenantId = this.resolveTenantId(),
  ): Promise<AtomicPointsMutationResult | null> {
    const rows = await this.client.$queryRaw<AtomicPointsMutationRow[]>`
      UPDATE "mkt_points_account"
      SET
        "available_points" = "available_points" - ${amount},
        "frozen_points" = "frozen_points" + ${amount},
        "version" = "version" + 1,
        "update_time" = NOW()
      WHERE "member_id" = ${memberId}
        AND "tenant_id" = ${tenantId}
        AND "available_points" >= ${amount}
      RETURNING
        "id",
        ("available_points" + ${amount})::int AS "balance_before",
        "available_points"::int AS "balance_after"
    `;

    return this.mapAtomicMutation(rows);
  }

  async atomicUnfreeze(
    memberId: string,
    amount: number,
    tenantId = this.resolveTenantId(),
  ): Promise<AtomicPointsMutationResult | null> {
    const rows = await this.client.$queryRaw<AtomicPointsMutationRow[]>`
      UPDATE "mkt_points_account"
      SET
        "available_points" = "available_points" + ${amount},
        "frozen_points" = "frozen_points" - ${amount},
        "version" = "version" + 1,
        "update_time" = NOW()
      WHERE "member_id" = ${memberId}
        AND "tenant_id" = ${tenantId}
        AND "frozen_points" >= ${amount}
      RETURNING
        "id",
        ("available_points" - ${amount})::int AS "balance_before",
        "available_points"::int AS "balance_after"
    `;

    return this.mapAtomicMutation(rows);
  }

  async atomicSettle(
    memberId: string,
    amount: number,
    tenantId = this.resolveTenantId(),
  ): Promise<AtomicPointsMutationResult | null> {
    const rows = await this.client.$queryRaw<AtomicPointsMutationRow[]>`
      UPDATE "mkt_points_account"
      SET
        "frozen_points" = "frozen_points" - ${amount},
        "used_points" = "used_points" + ${amount},
        "version" = "version" + 1,
        "update_time" = NOW()
      WHERE "member_id" = ${memberId}
        AND "tenant_id" = ${tenantId}
        AND "frozen_points" >= ${amount}
      RETURNING
        "id",
        "available_points"::int AS "balance_before",
        "available_points"::int AS "balance_after"
    `;

    return this.mapAtomicMutation(rows);
  }

  async atomicRefundSpent(
    memberId: string,
    amount: number,
    tenantId = this.resolveTenantId(),
  ): Promise<AtomicPointsMutationResult | null> {
    const rows = await this.client.$queryRaw<AtomicPointsMutationRow[]>`
      UPDATE "mkt_points_account"
      SET
        "available_points" = "available_points" + ${amount},
        "used_points" = GREATEST("used_points" - ${amount}, 0),
        "version" = "version" + 1,
        "update_time" = NOW()
      WHERE "member_id" = ${memberId}
        AND "tenant_id" = ${tenantId}
      RETURNING
        "id",
        ("available_points" - ${amount})::int AS "balance_before",
        "available_points"::int AS "balance_after"
    `;

    return this.mapAtomicMutation(rows);
  }

  async atomicExpireLotPoints(
    accountId: string,
    amount: number,
    tenantId = this.resolveTenantId(),
  ): Promise<AtomicPointsMutationResult | null> {
    const rows = await this.client.$queryRaw<AtomicPointsMutationRow[]>`
      WITH target AS (
        SELECT "id", "available_points"
        FROM "mkt_points_account"
        WHERE "id" = ${accountId}
          AND "tenant_id" = ${tenantId}
        FOR UPDATE
      )
      UPDATE "mkt_points_account" AS account
      SET
        "available_points" = GREATEST(account."available_points" - ${amount}, 0),
        "expired_points" = account."expired_points" + ${amount},
        "version" = account."version" + 1,
        "update_time" = NOW()
      FROM target
      WHERE account."id" = target."id"
      RETURNING
        account."id",
        target."available_points"::int AS "balance_before",
        account."available_points"::int AS "balance_after"
    `;

    return this.mapAtomicMutation(rows);
  }

  /**
   * 使用乐观锁更新账户余额
   *
   * @param accountId 账户ID
   * @param version 当前版本号
   * @param data 更新数据
   * @returns 更新后的账户
   */
  async updateWithOptimisticLock(
    accountId: string,
    version: number,
    data: Partial<MktPointsAccount>,
  ): Promise<MktPointsAccount | null> {
    const result = await this.client.mktPointsAccount.updateMany({
      where: {
        id: accountId,
        version,
      },
      data: {
        ...data,
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findById(accountId);
  }

  private resolveTenantId(): string {
    return TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;
  }

  private mapAtomicMutation(rows: AtomicPointsMutationRow[]): AtomicPointsMutationResult | null {
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      balanceBefore: row.balance_before,
      balanceAfter: row.balance_after,
    };
  }
}

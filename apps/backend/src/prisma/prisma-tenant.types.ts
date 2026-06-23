import { PrismaClient } from '@prisma/client';
import { tenantExtension } from 'src/common/tenant/tenant.extension';
import { softDeleteReadExtension } from './prisma-soft-delete.extension';

/** 租户扩展 + READ 侧软删过滤（软删层在外，先于租户合并 where） */
export function extendPrismaWithTenant(base: PrismaClient) {
  return base.$extends(tenantExtension).$extends(softDeleteReadExtension);
}

/** 已挂载 tenantExtension 的 Prisma 客户端类型 */
export type TenantAwarePrismaClient = ReturnType<typeof extendPrismaWithTenant>;

/** $transaction 的第一个参数（重载下常为「批量 Promise」与「交互式回调」的联合） */
type DollarTransactionFirstArg = Parameters<TenantAwarePrismaClient['$transaction']>[0];

/** 从交互式重载推断的 tx（与根客户端名义不同，不可与 Prisma.TransactionClient 混写） */
type TenantAwareInteractiveTx = DollarTransactionFirstArg extends (...args: infer A) => unknown ? A[0] : never;

/**
 * 业务里传入的 DB 客户端：完整 TenantAware 实例，或 $transaction 回调内的 tx。
 * 并集覆盖 @Transactional 下传入的 PrismaService 与 register 等场景下的 tx。
 */
export type AppPrismaTransactionClient = TenantAwarePrismaClient | TenantAwareInteractiveTx;

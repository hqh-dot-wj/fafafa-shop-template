import { DelFlag, Prisma } from '@prisma/client';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { MODELS_PASSTHROUGH_PHYSICAL_DELETE } from './prisma-soft-delete.middleware';

let modelsWithDelFlagCache: Set<string> | undefined;

/** Schema 中带 `delFlag` 字段的模型（DMMF，启动时缓存） */
export function getModelsWithDelFlag(): Set<string> {
  if (!modelsWithDelFlagCache) {
    modelsWithDelFlagCache = new Set(
      Prisma.dmmf.datamodel.models.filter((m) => m.fields.some((f) => f.name === 'delFlag')).map((m) => m.name),
    );
  }
  return modelsWithDelFlagCache;
}

/**
 * 在读路径的 `where` 上合并「未删除」条件（ADR-0003）。
 * - 若调用方已含 `delFlag` 条件则不覆盖（便于回收站等查询）。
 * - `OmsOrder` 若仅含 `deleteTime` 条件不含 `delFlag`，视为显式条件，不叠加 `delFlag`（兼容旧查询）。
 */
export function mergeSoftDeleteIntoWhere(model: string, where: unknown): Record<string, unknown> {
  const w = where && typeof where === 'object' ? { ...(where as Record<string, unknown>) } : {};

  if (MODELS_PASSTHROUGH_PHYSICAL_DELETE.has(model)) {
    return w;
  }

  if (!getModelsWithDelFlag().has(model)) {
    return w;
  }

  if (model === 'OmsOrder' && 'deleteTime' in w && !('delFlag' in w)) {
    return w;
  }

  if ('delFlag' in w) {
    return w;
  }

  return combineWhereWithClause(w, { delFlag: DelFlag.NORMAL });
}

function combineWhereWithClause(
  where: Record<string, unknown>,
  clause: Record<string, unknown>,
): Record<string, unknown> {
  if (Object.keys(where).length === 0) {
    return { ...clause };
  }

  if (where.OR) {
    return {
      AND: [clause, where],
    };
  }

  if (where.AND) {
    const and = where.AND;
    if (Array.isArray(and)) {
      return { ...where, AND: [...and, clause] };
    }
    return { ...where, AND: [and, clause] };
  }

  return { ...where, ...clause };
}

function shouldBypassSoftDeleteReadFilter(): boolean {
  return TenantContext.isIgnoreTenant() || TenantContext.isSuperTenant();
}

/** Prisma 各 query 的 args 形状不同，合并 where 后以 `never` 交回 `query()` 满足泛型约束 */
function mergeReadArgs(model: string, args: unknown): unknown {
  if (shouldBypassSoftDeleteReadFilter()) {
    return args;
  }
  const base = args !== null && typeof args === 'object' ? { ...(args as Record<string, unknown>) } : {};
  return {
    ...base,
    where: mergeSoftDeleteIntoWhere(model, (args as { where?: unknown } | undefined)?.where),
  };
}

/**
 * READ 侧自动排除已软删行；超级租户 / ignoreTenant 时不加条件（与租户扩展策略一致）。
 * 须挂在 `tenantExtension` **之外**（更靠近调用方），以便先合并软删再进入租户扩展。
 */
export const softDeleteReadExtension = Prisma.defineExtension((client) =>
  client.$extends({
    name: 'softDeleteRead',
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          return query(mergeReadArgs(model, args) as never);
        },
        async findFirst({ model, args, query }) {
          return query(mergeReadArgs(model, args) as never);
        },
        async findFirstOrThrow({ model, args, query }) {
          return query(mergeReadArgs(model, args) as never);
        },
        async findUnique({ model, args, query }) {
          return query(mergeReadArgs(model, args) as never);
        },
        async count({ model, args, query }) {
          return query(mergeReadArgs(model, args) as never);
        },
        async aggregate({ model, args, query }) {
          return query(mergeReadArgs(model, args) as never);
        },
        async groupBy({ model, args, query }) {
          return query(mergeReadArgs(model, args) as never);
        },
      },
    },
  }),
);

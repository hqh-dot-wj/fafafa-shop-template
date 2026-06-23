import { DelFlag, Prisma } from '@prisma/client';

/**
 * 软删时除 delFlag 外同时写入 deleteTime（审计）；删除语义以 delFlag 为准（见 ADR-0003）
 */
export const MODELS_SOFT_DELETE_WITH_DELETE_TIME_AUDIT = new Set<string>(['OmsOrder']);

let modelsWithDelFlagCache: Set<string> | undefined;

function getModelsWithDelFlag(): Set<string> {
  if (!modelsWithDelFlagCache) {
    modelsWithDelFlagCache = new Set(
      Prisma.dmmf.datamodel.models.filter((m) => m.fields.some((f) => f.name === 'delFlag')).map((m) => m.name),
    );
  }
  return modelsWithDelFlagCache;
}

/**
 * 无 delFlag、无 deleteTime 软删约定：保留 Prisma 物理 delete / deleteMany（调用方须自行评估风险）
 */
export const MODELS_PASSTHROUGH_PHYSICAL_DELETE = new Set<string>(['SysMessage']);

/**
 * Prisma `$use`：将 `delete` / `deleteMany` 转为软删或原样放行。
 * - 列入 passthrough 的模型 → 物理 delete
 * - 其余默认 → `update` / `updateMany` 写 `delFlag: DELETE`；`OmsOrder` 同时写 `deleteTime`
 *
 * READ 侧过滤见 `prisma-soft-delete.extension.ts`（`extendPrismaWithTenant` 外链路）。
 */
export function createSoftDeleteMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    if (params.action !== 'delete' && params.action !== 'deleteMany') {
      return next(params);
    }

    const model = params.model;
    if (!model || MODELS_PASSTHROUGH_PHYSICAL_DELETE.has(model) || !getModelsWithDelFlag().has(model)) {
      return next(params);
    }

    const args = params.args as Record<string, unknown>;
    const data: Record<string, unknown> = { delFlag: DelFlag.DELETE };
    if (MODELS_SOFT_DELETE_WITH_DELETE_TIME_AUDIT.has(model)) {
      data.deleteTime = new Date();
    }

    if (params.action === 'delete') {
      params.action = 'update';
      Object.assign(args, { data });
      return next(params);
    }

    params.action = 'updateMany';
    Object.assign(args, { data });
    return next(params);
  };
}

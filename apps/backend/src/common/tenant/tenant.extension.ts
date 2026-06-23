import { Prisma } from '@prisma/client';
import { TenantContext } from './tenant.context';

type TenantPrimitive = string | number | boolean | bigint | symbol | null | undefined | Date;
type TenantValue = TenantPrimitive | TenantObject | TenantValue[];
interface TenantObject {
  [key: string]: TenantValue;
}
interface TenantWhere extends TenantObject {
  tenantId?: string;
  AND?: TenantWhere | TenantWhere[];
  OR?: TenantWhere[];
}
interface TenantData extends TenantObject {
  tenantId?: string;
}
interface TenantMutableArgs {
  where?: TenantWhere;
  data?: TenantData | TenantData[];
  create?: TenantData;
}

/**
 * Prisma tenant extension（读侧与仓储分工见 docs/superpowers/specs/2026-03-26-tenant-repository-prisma-authority-design.md）:
 * - 读：不在此合并 where；列表/条件查询由 Repository（或调用方显式带 tenantId）
 * - findUnique：事后校验 tenantId，跨租户返回 null
 * - 写：自动补 tenantId、合并 where（兜底）
 */
export const tenantExtension = Prisma.defineExtension((client) => {
  return client.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }) {
          return query(args);
        },
        async findFirst({ args, query }) {
          return query(args);
        },
        async findUnique({ model, args, query }) {
          const result = await query(args);
          return validateTenantOwnership(model, result);
        },
        async findFirstOrThrow({ args, query }) {
          return query(args);
        },
        async count({ args, query }) {
          return query(args);
        },
        async aggregate({ args, query }) {
          return query(args);
        },
        async groupBy({ args, query }) {
          return query(args);
        },
        async create({ model, args, query }) {
          args = setTenantId(model, args);
          return query(args);
        },
        async createMany({ model, args, query }) {
          args = setTenantIdForMany(model, args);
          return query(args);
        },
        async update({ model, args, query }) {
          args = addTenantFilterForUpdate(model, args);
          return query(args);
        },
        async updateMany({ model, args, query }) {
          args = addTenantFilter(model, args);
          return query(args);
        },
        async delete({ model, args, query }) {
          args = addTenantFilterForDelete(model, args);
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          args = addTenantFilter(model, args);
          return query(args);
        },
        async upsert({ model, args, query }) {
          args = setTenantIdForUpsert(model, args);
          return query(args);
        },
      },
    },
  });
});

function getTenantModels(): string[] {
  const models = Prisma.dmmf.datamodel.models;
  return models
    .filter((model) => {
      const hasTenantId = model.fields.some((f) => f.name === 'tenantId');
      const isNotTenantModel = model.name !== 'SysTenant';
      return hasTenantId && isNotTenantModel;
    })
    .map((model) => model.name);
}

const TENANT_MODELS = getTenantModels();

function hasTenantField(model: string): boolean {
  return TENANT_MODELS.includes(model);
}

function toMutableArgs<TArgs>(args: TArgs): TenantMutableArgs {
  return (args ?? {}) as TenantMutableArgs;
}

function appendTenantToWhere(where: TenantWhere, tenantId: string): TenantWhere {
  if (where.AND) {
    if (Array.isArray(where.AND)) {
      where.AND.push({ tenantId });
    } else {
      where.AND = [where.AND, { tenantId }];
    }
    return where;
  }

  if (where.OR) {
    return {
      AND: [{ tenantId }, { OR: where.OR }],
    };
  }

  where.tenantId = tenantId;
  return where;
}

function validateTenantOwnership<TResult>(model: string, result: TResult): TResult | null {
  if (!result || !hasTenantField(model)) {
    return result;
  }

  if (TenantContext.isIgnoreTenant() || TenantContext.isSuperTenant()) {
    return result;
  }

  const currentTenantId = TenantContext.getTenantId();
  if (!currentTenantId || typeof result !== 'object') {
    return result;
  }

  const resultWithTenant = result as { tenantId?: string };
  if (resultWithTenant.tenantId && resultWithTenant.tenantId !== currentTenantId) {
    return null;
  }

  return result;
}

function addTenantFilterForDelete<TArgs>(model: string, args: TArgs): TArgs {
  if (!hasTenantField(model)) {
    return args;
  }

  if (TenantContext.isIgnoreTenant() || TenantContext.isSuperTenant()) {
    return args;
  }

  const tenantId = TenantContext.getTenantId();
  if (!tenantId) {
    return args;
  }

  const nextArgs = toMutableArgs(args);
  nextArgs.where = appendTenantToWhere(nextArgs.where ?? {}, tenantId);

  return nextArgs as TArgs;
}

function addTenantFilter<TArgs>(model: string, args: TArgs): TArgs {
  if (!hasTenantField(model)) {
    return args;
  }

  if (TenantContext.isIgnoreTenant() || TenantContext.isSuperTenant()) {
    return args;
  }

  const tenantId = TenantContext.getTenantId();
  if (!tenantId) {
    return args;
  }

  const nextArgs = toMutableArgs(args);
  nextArgs.where = nextArgs.where ?? {};
  nextArgs.where.tenantId = tenantId;

  return nextArgs as TArgs;
}

function addTenantFilterForUpdate<TArgs>(model: string, args: TArgs): TArgs {
  if (!hasTenantField(model)) {
    return args;
  }

  if (TenantContext.isIgnoreTenant() || TenantContext.isSuperTenant()) {
    return args;
  }

  const tenantId = TenantContext.getTenantId();
  if (!tenantId) {
    return args;
  }

  const nextArgs = toMutableArgs(args);
  nextArgs.where = appendTenantToWhere(nextArgs.where ?? {}, tenantId);

  return nextArgs as TArgs;
}

function setTenantId<TArgs>(model: string, args: TArgs): TArgs {
  if (!hasTenantField(model)) {
    return args;
  }

  const tenantId = TenantContext.getTenantId();
  if (!tenantId) {
    return args;
  }

  const nextArgs = toMutableArgs(args);
  const currentData = nextArgs.data;
  if (!currentData || Array.isArray(currentData)) {
    return nextArgs as TArgs;
  }

  if (!currentData.tenantId) {
    currentData.tenantId = tenantId;
  }

  return nextArgs as TArgs;
}

function setTenantIdForMany<TArgs>(model: string, args: TArgs): TArgs {
  if (!hasTenantField(model)) {
    return args;
  }

  const tenantId = TenantContext.getTenantId();
  if (!tenantId) {
    return args;
  }

  const nextArgs = toMutableArgs(args);
  if (Array.isArray(nextArgs.data)) {
    nextArgs.data = nextArgs.data.map((item: TenantData) => ({
      ...item,
      tenantId: item.tenantId || tenantId,
    }));
  }

  return nextArgs as TArgs;
}

function setTenantIdForUpsert<TArgs>(model: string, args: TArgs): TArgs {
  if (!hasTenantField(model)) {
    return args;
  }

  const tenantId = TenantContext.getTenantId();
  if (!tenantId) {
    return args;
  }

  const nextArgs = toMutableArgs(args);
  if (nextArgs.create && !nextArgs.create.tenantId) {
    nextArgs.create.tenantId = tenantId;
  }

  return nextArgs as TArgs;
}

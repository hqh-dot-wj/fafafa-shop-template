import { SetMetadata } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsService, ClsServiceManager } from 'nestjs-cls';

type ErrorConstructorArg = string | number | boolean | object | null | undefined;
type ErrorConstructorLike = new (...args: ErrorConstructorArg[]) => Error;

type ClsRuntime = Pick<ClsService, 'get' | 'set' | 'run' | 'isActive'>;
type TransactionalHost = { prisma?: TxCapablePrisma; cls?: unknown };
type TransactionExecutionOptions = {
  isolationLevel?: Prisma.TransactionIsolationLevel;
  timeout?: number;
};
type TxCapablePrisma = {
  $transaction: <T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: TransactionExecutionOptions,
  ) => Promise<T>;
};

const PRISMA_TX_KEY = 'PRISMA_TX';

/**
 * 事务装饰器元数据键
 */
export const TRANSACTIONAL_KEY = 'TRANSACTIONAL';

/**
 * 事务隔离级别
 */
export enum IsolationLevel {
  ReadUncommitted = 'ReadUncommitted',
  ReadCommitted = 'ReadCommitted',
  RepeatableRead = 'RepeatableRead',
  Serializable = 'Serializable',
}

/**
 * 事务传播行为
 */
export enum Propagation {
  /** 如果当前存在事务，则加入该事务；如果当前没有事务，则创建一个新的事务 */
  REQUIRED = 'REQUIRED',
  /** 创建一个新的事务，如果当前存在事务，则挂起当前事务 */
  REQUIRES_NEW = 'REQUIRES_NEW',
  /** 如果当前存在事务，则加入该事务；如果当前没有事务，则以非事务方式执行 */
  SUPPORTS = 'SUPPORTS',
  /** 以非事务方式执行，如果当前存在事务，则挂起当前事务 */
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  /** 如果当前存在事务，则加入该事务；如果当前没有事务，则抛出异常 */
  MANDATORY = 'MANDATORY',
  /** 以非事务方式执行，如果当前存在事务，则抛出异常 */
  NEVER = 'NEVER',
}

const ISOLATION_LEVEL_MAP: Record<IsolationLevel, Prisma.TransactionIsolationLevel> = {
  [IsolationLevel.ReadUncommitted]: 'ReadUncommitted' as Prisma.TransactionIsolationLevel,
  [IsolationLevel.ReadCommitted]: 'ReadCommitted' as Prisma.TransactionIsolationLevel,
  [IsolationLevel.RepeatableRead]: 'RepeatableRead' as Prisma.TransactionIsolationLevel,
  [IsolationLevel.Serializable]: 'Serializable' as Prisma.TransactionIsolationLevel,
};

/**
 * 事务选项
 */
export interface TransactionalOptions {
  /** 隔离级别 */
  isolationLevel?: IsolationLevel;
  /** 传播行为 */
  propagation?: Propagation;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 只读事务 */
  readOnly?: boolean;
  /** 回滚异常类型 */
  rollbackFor?: ErrorConstructorLike[];
  /** 不回滚异常类型 */
  noRollbackFor?: ErrorConstructorLike[];
}

class NonRollbackErrorCarrier {
  constructor(readonly error: Error) {}
}

function normalizeOptions(options?: TransactionalOptions): Required<Omit<TransactionalOptions, 'timeout'>> &
  Pick<TransactionalOptions, 'timeout'> {
  return {
    isolationLevel: options?.isolationLevel ?? IsolationLevel.ReadCommitted,
    propagation: options?.propagation ?? Propagation.REQUIRED,
    timeout: options?.timeout,
    readOnly: options?.readOnly ?? false,
    rollbackFor: options?.rollbackFor ?? [],
    noRollbackFor: options?.noRollbackFor ?? [],
  };
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(String(error));
}

function shouldRollback(error: Error, options: TransactionalOptions): boolean {
  if (options.noRollbackFor?.length) {
    for (const ExceptionType of options.noRollbackFor) {
      if (error instanceof ExceptionType) {
        return false;
      }
    }
  }

  if (options.rollbackFor?.length) {
    for (const ExceptionType of options.rollbackFor) {
      if (error instanceof ExceptionType) {
        return true;
      }
    }
    return false;
  }

  return true;
}

function isClsRuntime(value: unknown): value is ClsRuntime {
  if (!value || typeof value !== 'object') return false;
  const runtime = value as Partial<ClsRuntime>;
  return (
    typeof runtime.get === 'function' &&
    typeof runtime.set === 'function' &&
    typeof runtime.run === 'function' &&
    typeof runtime.isActive === 'function'
  );
}

function isTxCapablePrisma(value: unknown): value is TxCapablePrisma {
  if (!value || typeof value !== 'object') return false;
  return typeof (value as { $transaction?: unknown }).$transaction === 'function';
}

function resolvePrismaClient(host: TransactionalHost): TxCapablePrisma | undefined {
  if (isTxCapablePrisma(host.prisma)) {
    return host.prisma;
  }

  for (const value of Object.values(host as Record<string, unknown>)) {
    if (isTxCapablePrisma(value)) {
      return value;
    }
    if (value && typeof value === 'object') {
      const nestedPrisma = (value as Record<string, unknown>).prisma;
      if (isTxCapablePrisma(nestedPrisma)) {
        return nestedPrisma;
      }
    }
  }

  return undefined;
}

function resolveClsRuntime(host: TransactionalHost): ClsRuntime | undefined {
  if (isClsRuntime(host.cls)) {
    return host.cls;
  }
  try {
    const globalCls = ClsServiceManager.getClsService();
    return isClsRuntime(globalCls) ? globalCls : undefined;
  } catch {
    return undefined;
  }
}

function safeIsActive(cls: ClsRuntime): boolean {
  try {
    return cls.isActive();
  } catch {
    return false;
  }
}

function safeGetTx(cls?: ClsRuntime): Prisma.TransactionClient | undefined {
  if (!cls) return undefined;
  try {
    return cls.get<Prisma.TransactionClient>(PRISMA_TX_KEY);
  } catch {
    return undefined;
  }
}

function safeSetTx(cls: ClsRuntime | undefined, tx: Prisma.TransactionClient | undefined): void {
  if (!cls) return;
  try {
    cls.set(PRISMA_TX_KEY, tx);
  } catch {
    // 无 CLS 上下文时忽略，允许事务降级为局部作用域
  }
}

async function safeRunWithCls<T>(cls: ClsRuntime, callback: () => Promise<T>): Promise<T> {
  try {
    return await cls.run(callback);
  } catch {
    return await callback();
  }
}

async function runWithTransactionContext<T>(
  cls: ClsRuntime | undefined,
  tx: Prisma.TransactionClient,
  callback: () => Promise<T>,
): Promise<T> {
  const execute = async () => {
    const previousTx = safeGetTx(cls);
    safeSetTx(cls, tx);
    try {
      return await callback();
    } finally {
      safeSetTx(cls, previousTx);
    }
  };

  if (!cls) return await execute();
  if (safeIsActive(cls)) return await execute();
  return await safeRunWithCls(cls, execute);
}

async function runWithoutTransaction<T>(
  cls: ClsRuntime | undefined,
  existingTx: Prisma.TransactionClient | undefined,
  callback: () => Promise<T>,
): Promise<T> {
  if (!cls || !existingTx) return await callback();
  safeSetTx(cls, undefined);
  try {
    return await callback();
  } finally {
    safeSetTx(cls, existingTx);
  }
}

/**
 * 事务装饰器
 *
 * @description 声明式事务管理，标记方法需要在事务中执行
 *
 * @example
 * ```typescript
 * @Transactional()
 * async createUserWithRoles(data: CreateUserDto) {
 *   const user = await this.userRepo.create(data);
 *   await this.roleRepo.bindRoles(user.id, data.roleIds);
 *   return user;
 * }
 *
 * @Transactional({ isolationLevel: IsolationLevel.Serializable })
 * async transferMoney(from: number, to: number, amount: number) {
 *   // 需要串行化隔离级别的操作
 * }
 * ```
 */
export function Transactional(options?: TransactionalOptions): MethodDecorator {
  const normalizedOptions = normalizeOptions(options);

  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    if (typeof originalMethod !== 'function') {
      SetMetadata(TRANSACTIONAL_KEY, normalizedOptions)(target, propertyKey, descriptor);
      return descriptor;
    }

    descriptor.value = async function (...args: unknown[]) {
      const host = this as TransactionalHost;
      const cls = resolveClsRuntime(host);
      const existingTx = safeGetTx(cls);

      if (normalizedOptions.readOnly) {
        return await originalMethod.apply(this, args);
      }

      if (normalizedOptions.propagation === Propagation.NEVER && existingTx) {
        throw new Error(`@Transactional(${String(propertyKey)}) 不允许在事务中执行`);
      }

      if (normalizedOptions.propagation === Propagation.MANDATORY && !existingTx) {
        throw new Error(`@Transactional(${String(propertyKey)}) 要求存在活动事务`);
      }

      if (normalizedOptions.propagation === Propagation.NOT_SUPPORTED) {
        return await runWithoutTransaction(cls, existingTx, () => originalMethod.apply(this, args));
      }

      if (existingTx && normalizedOptions.propagation !== Propagation.REQUIRES_NEW) {
        return await originalMethod.apply(this, args);
      }

      if (normalizedOptions.propagation === Propagation.SUPPORTS) {
        return await originalMethod.apply(this, args);
      }

      const prisma = resolvePrismaClient(host);
      if (!prisma) {
        return await originalMethod.apply(this, args);
      }

      const txResult = await prisma.$transaction(
        async (tx) =>
          await runWithTransactionContext(cls, tx, async () => {
            try {
              return await originalMethod.apply(this, args);
            } catch (error) {
              const normalizedError = normalizeError(error);
              if (shouldRollback(normalizedError, normalizedOptions)) {
                throw normalizedError;
              }
              return new NonRollbackErrorCarrier(normalizedError);
            }
          }),
        {
          isolationLevel: ISOLATION_LEVEL_MAP[normalizedOptions.isolationLevel],
          timeout: normalizedOptions.timeout,
        },
      );

      if (txResult instanceof NonRollbackErrorCarrier) {
        throw txResult.error;
      }

      return txResult;
    };

    SetMetadata(TRANSACTIONAL_KEY, normalizedOptions)(target, propertyKey, descriptor);
    return descriptor;
  };
}

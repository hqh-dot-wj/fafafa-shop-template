import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../prisma/prisma.service';
import {
  TRANSACTIONAL_KEY,
  TransactionalOptions,
  IsolationLevel,
  Propagation,
} from '../decorators/transactional.decorator';
import { Prisma } from '@prisma/client';

type TransactionalValue = object | string | number | boolean | null | undefined;
type TransactionalResult = TransactionalValue | Error;

const ISOLATION_LEVEL_MAP: Record<IsolationLevel, Prisma.TransactionIsolationLevel> = {
  [IsolationLevel.ReadUncommitted]: 'ReadUncommitted' as Prisma.TransactionIsolationLevel,
  [IsolationLevel.ReadCommitted]: 'ReadCommitted' as Prisma.TransactionIsolationLevel,
  [IsolationLevel.RepeatableRead]: 'RepeatableRead' as Prisma.TransactionIsolationLevel,
  [IsolationLevel.Serializable]: 'Serializable' as Prisma.TransactionIsolationLevel,
};

@Injectable()
export class TransactionalInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TransactionalInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler<TransactionalValue>): Observable<TransactionalValue> {
    const options = this.reflector.get<TransactionalOptions>(TRANSACTIONAL_KEY, context.getHandler());

    if (!options) {
      return next.handle();
    }

    if (options.readOnly) {
      return next.handle();
    }

    switch (options.propagation) {
      case Propagation.NOT_SUPPORTED:
      case Propagation.NEVER:
        return next.handle();
      case Propagation.SUPPORTS:
        return next.handle();
      case Propagation.REQUIRED:
      case Propagation.REQUIRES_NEW:
      case Propagation.MANDATORY:
      default:
        return this.executeInTransaction(next, options);
    }
  }

  private executeInTransaction(
    next: CallHandler<TransactionalValue>,
    options: TransactionalOptions,
  ): Observable<TransactionalValue> {
    return from(
      this.prisma.$transaction(
        async (tx) => {
          this.cls.set('PRISMA_TX', tx);
          return new Promise<TransactionalResult>((resolve, reject) => {
            next.handle().subscribe({
              next: (value) => resolve(value),
              error: (err: TransactionalValue | Error) => {
                const normalizedError = err instanceof Error ? err : new Error(String(err));
                if (this.shouldRollback(normalizedError, options)) {
                  reject(normalizedError);
                } else {
                  resolve(normalizedError);
                }
              },
            });
          });
        },
        {
          isolationLevel: ISOLATION_LEVEL_MAP[options.isolationLevel || IsolationLevel.ReadCommitted],
          timeout: options.timeout,
        },
      ),
    ).pipe(
      mergeMap((result) => {
        if (result instanceof Error) {
          throw result;
        }
        return [result];
      }),
    );
  }

  private shouldRollback(error: Error, options: TransactionalOptions): boolean {
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
}

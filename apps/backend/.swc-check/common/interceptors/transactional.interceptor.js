'use strict';
Object.defineProperty(exports, '__esModule', {
  value: true,
});
Object.defineProperty(exports, 'TransactionalInterceptor', {
  enumerable: true,
  get: function () {
    return TransactionalInterceptor;
  },
});
const _common = require('@nestjs/common');
const _core = require('@nestjs/core');
const _rxjs = require('rxjs');
const _operators = require('rxjs/operators');
const _nestjscls = require('nestjs-cls');
const _prismaservice = require('../../prisma/prisma.service');
const _transactionaldecorator = require('../decorators/transactional.decorator');
const _client = require('@prisma/client');
function _define_property(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
function _ts_decorate(decorators, target, key, desc) {
  var c = arguments.length,
    r = c < 3 ? target : desc === null ? (desc = Object.getOwnPropertyDescriptor(target, key)) : desc,
    d;
  if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function')
    r = Reflect.decorate(decorators, target, key, desc);
  else
    for (var i = decorators.length - 1; i >= 0; i--)
      if ((d = decorators[i])) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
  if (typeof Reflect === 'object' && typeof Reflect.metadata === 'function') return Reflect.metadata(k, v);
}
const ISOLATION_LEVEL_MAP = {
  [_transactionaldecorator.IsolationLevel.ReadUncommitted]: _client.Prisma.TransactionIsolationLevel.ReadUncommitted,
  [_transactionaldecorator.IsolationLevel.ReadCommitted]: _client.Prisma.TransactionIsolationLevel.ReadCommitted,
  [_transactionaldecorator.IsolationLevel.RepeatableRead]: _client.Prisma.TransactionIsolationLevel.RepeatableRead,
  [_transactionaldecorator.IsolationLevel.Serializable]: _client.Prisma.TransactionIsolationLevel.Serializable,
};
let TransactionalInterceptor = class TransactionalInterceptor {
  intercept(context, next) {
    const options = this.reflector.get(_transactionaldecorator.TRANSACTIONAL_KEY, context.getHandler());
    if (!options) {
      return next.handle();
    }
    if (options.readOnly) {
      return next.handle();
    }
    switch (options.propagation) {
      case _transactionaldecorator.Propagation.NOT_SUPPORTED:
      case _transactionaldecorator.Propagation.NEVER:
        return next.handle();
      case _transactionaldecorator.Propagation.SUPPORTS:
        return next.handle();
      case _transactionaldecorator.Propagation.REQUIRED:
      case _transactionaldecorator.Propagation.REQUIRES_NEW:
      case _transactionaldecorator.Propagation.MANDATORY:
      default:
        return this.executeInTransaction(next, options);
    }
  }
  executeInTransaction(next, options) {
    return (0, _rxjs.from)(
      this.prisma.$transaction(
        async (tx) => {
          this.cls.set('PRISMA_TX', tx);
          return new Promise((resolve, reject) => {
            next.handle().subscribe({
              next: (value) => resolve(value),
              error: (err) => {
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
          isolationLevel:
            ISOLATION_LEVEL_MAP[options.isolationLevel || _transactionaldecorator.IsolationLevel.ReadCommitted],
          timeout: options.timeout,
        },
      ),
    ).pipe(
      (0, _operators.mergeMap)((result) => {
        if (result instanceof Error) {
          throw result;
        }
        return [result];
      }),
    );
  }
  shouldRollback(error, options) {
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
  constructor(reflector, prisma, cls) {
    _define_property(this, 'reflector', void 0);
    _define_property(this, 'prisma', void 0);
    _define_property(this, 'cls', void 0);
    _define_property(this, 'logger', void 0);
    this.reflector = reflector;
    this.prisma = prisma;
    this.cls = cls;
    this.logger = new _common.Logger(TransactionalInterceptor.name);
  }
};
TransactionalInterceptor = _ts_decorate(
  [
    (0, _common.Injectable)(),
    _ts_metadata('design:type', Function),
    _ts_metadata('design:paramtypes', [
      typeof _core.Reflector === 'undefined' ? Object : _core.Reflector,
      typeof _prismaservice.PrismaService === 'undefined' ? Object : _prismaservice.PrismaService,
      typeof _nestjscls.ClsService === 'undefined' ? Object : _nestjscls.ClsService,
    ]),
  ],
  TransactionalInterceptor,
);

//# sourceMappingURL=transactional.interceptor.js.map

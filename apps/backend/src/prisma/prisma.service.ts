import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { AppConfigService } from 'src/config/app-config.service';
import { assertValidPostgresDatabaseUrl } from 'src/config/database-url.util';
import { extendPrismaWithTenant, type TenantAwarePrismaClient } from './prisma-tenant.types';
import { createSoftDeleteMiddleware } from './prisma-soft-delete.middleware';
import { ClsService } from 'nestjs-cls';

export type { TenantAwarePrismaClient } from './prisma-tenant.types';

const PRISMA_SERVICE_OWN_KEYS = new Set([
  'logger',
  'config',
  'cls',
  'prismaInner',
  'resolveTransactionClient',
  'readPositiveInt',
  'onModuleInit',
  'onModuleDestroy',
  'constructor',
  'then',
]);

function createPrismaServiceProxy(service: PrismaService): PrismaService {
  return new Proxy(service, {
    get(target, prop, receiver) {
      if (typeof prop === 'symbol') {
        return Reflect.get(target, prop, receiver);
      }
      if (PRISMA_SERVICE_OWN_KEYS.has(prop)) {
        if (prop === 'then') {
          return undefined;
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      }

      const txClient = target.resolveTransactionClient();
      if (txClient && Reflect.has(txClient as object, prop)) {
        const txDelegated = Reflect.get(txClient as object, prop, txClient as object);
        return typeof txDelegated === 'function' ? txDelegated.bind(txClient) : txDelegated;
      }

      const inner = target.prismaInner;
      const delegated = Reflect.get(inner, prop, receiver);
      return typeof delegated === 'function' ? delegated.bind(inner) : delegated;
    },
  }) as PrismaService;
}

// 实例在结构上等同于 TenantAwarePrismaClient（见 prisma-service.augment.d.ts 合并声明）
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly logger = new Logger(PrismaService.name);

  /**
   * 带 tenantExtension 的 Prisma 客户端；一般通过注入的 `PrismaService` 直接访问 model（代理转发）。
   */
  readonly prismaInner: TenantAwarePrismaClient;

  constructor(
    public readonly config: AppConfigService,
    @Optional() private readonly cls?: ClsService,
  ) {
    const url = config.db.databaseUrl.trim();
    assertValidPostgresDatabaseUrl(url);
    const connectionLimit = this.readPositiveInt(process.env.PRISMA_CONNECTION_LIMIT, 10);
    const poolTimeout = this.readPositiveInt(process.env.PRISMA_POOL_TIMEOUT_SECONDS, 30);
    const connectTimeout = this.readPositiveInt(process.env.PRISMA_CONNECT_TIMEOUT_SECONDS, 10);

    const base = new PrismaClient({
      datasources: {
        db: {
          url,
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      // @ts-expect-error - Prisma内部配置，提升并发性能
      __internal: {
        engine: {
          connection_limit: connectionLimit,
          pool_timeout: poolTimeout,
          connect_timeout: connectTimeout,
        },
      },
    });

    base.$use(createSoftDeleteMiddleware());

    this.prismaInner = extendPrismaWithTenant(base);
    return createPrismaServiceProxy(this);
  }

  async onModuleInit() {
    await this.prismaInner.$connect();

    this.logger.log('Prisma connected to PostgreSQL successfully (tenant extension enabled).');
  }

  async onModuleDestroy() {
    await this.prismaInner.$disconnect();
  }

  resolveTransactionClient(): Prisma.TransactionClient | null {
    if (!this.cls) return null;
    try {
      if (!this.cls.isActive()) return null;
      return this.cls.get<Prisma.TransactionClient>('PRISMA_TX') ?? null;
    } catch {
      return null;
    }
  }

  private readPositiveInt(raw: string | undefined, fallback: number): number {
    if (!raw || raw.trim().length === 0) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.trunc(parsed);
  }
}

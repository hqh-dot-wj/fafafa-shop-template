import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { assertValidPostgresDatabaseUrl } from 'src/config/database-url.util';

/**
 * SystemPrismaService - 不应用租户扩展的 Prisma 客户端
 *
 * 用于访问系统级表（如 sys_system_config），这些表不需要租户隔离
 *
 * 关键特性：
 * 1. 不使用 tenantExtension - 所有查询不会自动添加 tenant_id 过滤
 * 2. 使用相同的数据库连接配置
 * 3. 专门用于系统级配置和跨租户操作
 *
 * @example
 * ```typescript
 * // 查询系统配置（无租户过滤）
 * const config = await this.systemPrisma.sysSystemConfig.findUnique({
 *   where: { configKey: 'sys.account.captchaEnabled' }
 * });
 * ```
 */
@Injectable()
export class SystemPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly config: ConfigService) {
    const raw = config.get<string>('db.databaseUrl') ?? '';
    const url = raw.trim();
    if (!url) {
      throw new Error('未配置数据库连接 URL，请设置环境变量 DATABASE_URL（对应配置键 db.databaseUrl）');
    }
    assertValidPostgresDatabaseUrl(url);

    super({
      datasources: {
        db: { url },
      },
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

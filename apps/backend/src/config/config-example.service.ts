import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from 'src/config/app-config.service';
import { assertValidPostgresDatabaseUrl, redactDatabaseUrl } from 'src/config/database-url.util';

type DeprecatedArg = string | number | boolean | object | null | undefined;
type DeprecatedResult = object | string | number | boolean | null | undefined | void;

@Injectable()
export class ConfigExampleService {
  private readonly logger = new Logger(ConfigExampleService.name);

  constructor(private readonly config: AppConfigService) {}

  getAppConfig() {
    const port = this.config.app.port;
    const prefix = this.config.app.prefix;
    const env = this.config.app.env;

    this.logger.log(`应用运行在 ${env} 环境，端口 ${port}，前缀 ${prefix}`);
  }

  getDatabaseConfig() {
    const { databaseUrl } = this.config.db;
    assertValidPostgresDatabaseUrl(databaseUrl);

    const parsed = new URL(databaseUrl);
    const databaseName = parsed.pathname.replace(/^\/+/, '').split('/')[0] ?? '';
    const portSegment = parsed.port ? `:${parsed.port}` : '';

    this.logger.log(`数据库连接: ${parsed.hostname}${portSegment}/${databaseName}`);
    this.logger.log('完整配置（脱敏）:', { databaseUrl: redactDatabaseUrl(databaseUrl) });
  }

  getRedisConfig() {
    const redis = this.config.redis;

    return {
      host: redis.host,
      port: redis.port,
      db: redis.db,
      keyPrefix: redis.keyPrefix,
    };
  }

  environmentChecks() {
    if (this.config.isProduction) {
      this.logger.log('生产环境: 启用所有安全特性');
    } else if (this.config.isDevelopment) {
      this.logger.log('开发环境: 启用调试日志');
    } else if (this.config.isTest) {
      this.logger.log('测试环境: 使用测试数据库');
    }
  }

  getJwtConfig() {
    const { secretkey, expiresin, refreshExpiresIn } = this.config.jwt;

    this.logger.log(`JWT 配置: 过期时间 ${expiresin}, 刷新过期时间 ${refreshExpiresIn}`);
    this.logger.log(`密钥长度: ${secretkey.length} 字符`);
  }

  getTenantConfig() {
    const tenant = this.config.tenant;

    if (tenant.enabled) {
      this.logger.log(`多租户已启用，超级租户ID: ${tenant.superTenantId}`);
    } else {
      this.logger.log('多租户已禁用');
    }

    return tenant;
  }

  getFileConfig() {
    const file = this.config.app.file;

    if (file.isLocal) {
      this.logger.log(`本地存储: ${file.location}`);
    } else {
      this.logger.log(`云存储: ${file.domain}`);
    }

    this.logger.log(`最大文件大小: ${file.maxSize}MB`);
    this.logger.log(`缩略图: ${file.thumbnailEnabled ? '启用' : '禁用'}`);
  }

  getLoggerConfig() {
    const logger = this.config.app.logger;

    this.logger.log('日志配置:', {
      level: logger.level,
      dir: logger.dir,
      toFile: logger.toFile,
      prettyPrint: logger.prettyPrint,
    });

    return logger;
  }

  getPermissionConfig() {
    const whitelist = this.config.perm.router.whitelist;

    this.logger.log('路由白名单:');
    whitelist.forEach((route) => {
      this.logger.log(`  ${route.method} ${route.path}`);
    });

    return whitelist;
  }

  getAllConfig() {
    if (!this.config.isProduction) {
      this.logger.log('完整配置:', this.config.all);
    }
  }

  getTimeoutBasedOnEnvironment() {
    return this.config.isProduction ? 5000 : 30000;
  }

  @Deprecated('请使用类型安全的 config.app.port')
  getPortOldWay() {
    return this.config.getValue<number>('app.port', 8080);
  }
}

function Deprecated(message: string): MethodDecorator {
  return function (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): void {
    const original = descriptor.value as ((...args: DeprecatedArg[]) => DeprecatedResult) | undefined;
    if (!original) {
      return;
    }

    descriptor.value = function (...args: DeprecatedArg[]) {
      Logger.warn(`[DEPRECATED] ${String(propertyKey)}: ${message}`, 'Deprecated');
      return original.apply(this, args);
    };
  };
}

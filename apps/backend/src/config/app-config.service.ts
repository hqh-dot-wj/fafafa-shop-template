import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import {
  AppConfig,
  DatabaseConfig,
  RedisConfig,
  JwtConfig,
  TenantConfig,
  CryptoConfig,
  CosConfig,
  OssConfig,
  PermissionConfig,
  GeneratorConfig,
  UserConfig,
  ClientConfig,
  WechatConfig,
  SocialConfig,
  Configuration,
} from './types';

type ConfigPrimitive = string | number | boolean | null | undefined;
type ConfigValue = ConfigPrimitive | ConfigMap | ConfigValue[];
interface ConfigMap {
  [key: string]: ConfigValue;
}

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: NestConfigService<Configuration, true>) {}

  get all(): Configuration {
    return {
      app: this.app,
      db: this.db,
      redis: this.redis,
      jwt: this.jwt,
      tenant: this.tenant,
      crypto: this.crypto,
      cos: this.cos,
      oss: this.oss,
      perm: this.perm,
      gen: this.gen,
      user: this.user,
      client: this.client,
      wechat: this.wechat,
      social: this.social,
    };
  }

  get app(): AppConfig {
    return this.configService.get('app', { infer: true });
  }

  get db(): DatabaseConfig {
    return this.configService.get('db', { infer: true });
  }

  get redis(): RedisConfig {
    return this.configService.get('redis', { infer: true });
  }

  get jwt(): JwtConfig {
    return this.configService.get('jwt', { infer: true });
  }

  get tenant(): TenantConfig {
    return this.configService.get('tenant', { infer: true });
  }

  get crypto(): CryptoConfig {
    return this.configService.get('crypto', { infer: true });
  }

  get cos(): CosConfig {
    return this.configService.get('cos', { infer: true });
  }

  get oss(): OssConfig {
    return this.configService.get('oss', { infer: true });
  }

  get perm(): PermissionConfig {
    return this.configService.get('perm', { infer: true });
  }

  get gen(): GeneratorConfig {
    return this.configService.get('gen', { infer: true });
  }

  get user(): UserConfig {
    return this.configService.get('user', { infer: true });
  }

  get client(): ClientConfig {
    return this.configService.get('client', { infer: true });
  }

  get wechat(): WechatConfig {
    return this.configService.get('wechat', { infer: true });
  }

  get social(): SocialConfig | undefined {
    return this.configService.get('social', { infer: true });
  }

  get isProduction(): boolean {
    return this.app.env === 'production';
  }

  get isDevelopment(): boolean {
    return this.app.env === 'development';
  }

  get isTest(): boolean {
    return this.app.env === 'test';
  }

  /** @deprecated prefer typed getters above */
  getValue<T extends ConfigValue>(path: string, defaultValue?: T): T {
    const segments = path.split('.');
    let current: object | ConfigValue[] | ConfigPrimitive = this.all;

    for (const segment of segments) {
      if (typeof current !== 'object' || current === null || Array.isArray(current)) {
        return defaultValue as T;
      }

      const currentMap = current as ConfigMap;
      const next = currentMap[segment];
      if (next === undefined) {
        return defaultValue as T;
      }
      current = next;
    }

    return current as T;
  }
}

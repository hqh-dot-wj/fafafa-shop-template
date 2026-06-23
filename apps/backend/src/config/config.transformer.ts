import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { redactDatabaseUrl } from './database-url.util';
import { Configuration } from './types/index';

type RawConfigPrimitive = string | number | boolean | null | undefined;
type RawConfigValue = RawConfigPrimitive | RawConfigMap | RawConfigValue[];
interface RawConfigMap {
  [key: string]: RawConfigValue;
}

export class ConfigTransformer {
  static transform(rawConfig: RawConfigMap): Configuration {
    const config = plainToInstance(Configuration, rawConfig, {
      enableImplicitConversion: true,
      exposeDefaultValues: true,
    });

    const errors = validateSync(config, {
      skipMissingProperties: false,
      whitelist: true,
      forbidNonWhitelisted: false,
    });

    if (errors.length > 0) {
      const errorMessages = errors
        .map((error) => {
          const constraints = error.constraints ? Object.values(error.constraints).join(', ') : '';
          const children = error.children?.length
            ? error.children
                .map((child) =>
                  child.constraints ? `  ${child.property}: ${Object.values(child.constraints).join(', ')}` : '',
                )
                .filter(Boolean)
                .join('\n')
            : '';

          return `${error.property}: ${constraints}${children ? '\n' + children : ''}`;
        })
        .join('\n');

      throw new Error(`配置验证失败:\n${errorMessages}`);
    }

    return config;
  }

  static printSafe(config: Configuration): string {
    const safeConfig = JSON.parse(JSON.stringify(config)) as Configuration;

    if (safeConfig.db?.databaseUrl) {
      safeConfig.db.databaseUrl = redactDatabaseUrl(safeConfig.db.databaseUrl);
    }
    if (safeConfig.redis?.password) {
      safeConfig.redis.password = '******';
    }
    if (safeConfig.jwt?.secretkey) {
      safeConfig.jwt.secretkey = '******';
    }
    if (safeConfig.crypto?.rsaPrivateKey) {
      safeConfig.crypto.rsaPrivateKey = '******';
    }
    if (safeConfig.cos?.secretKey) {
      safeConfig.cos.secretKey = '******';
    }
    if (safeConfig.oss?.accessKeySecret) {
      safeConfig.oss.accessKeySecret = '******';
    }

    return JSON.stringify(safeConfig, null, 2);
  }
}

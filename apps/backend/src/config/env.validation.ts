import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
  Matches,
  MinLength,
} from 'class-validator';

/**
 * 环境变量验证类
 *
 * @description
 * 这个类定义了必需的环境变量及其验证规则
 * 在应用启动时自动验证，确保环境配置正确
 *
 * 验证规则：
 * - 必需字段使用 @IsNotEmpty() 或不加 @IsOptional()
 * - 可选字段使用 @IsOptional()
 * - 类型验证使用 @IsString(), @IsNumber(), @IsBoolean() 等
 * - 枚举验证使用 @IsIn([...])
 * - 自定义验证使用 @Matches() 或自定义装饰器
 */
class EnvironmentVariables {
  // ==================== 核心配置 ====================

  @IsIn(['development', 'test', 'production'])
  NODE_ENV: string;

  @IsString()
  DATABASE_URL: string;

  // ==================== 应用配置 ====================

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  APP_PORT?: number;

  @IsOptional()
  @IsString()
  APP_PREFIX?: string;

  // ==================== 日志配置 ====================

  @IsOptional()
  @IsString()
  LOG_DIR?: string;

  @IsOptional()
  @IsIn(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
  LOG_LEVEL?: string;

  @IsOptional()
  @IsBoolean()
  LOG_PRETTY_PRINT?: boolean;

  @IsOptional()
  @IsBoolean()
  LOG_TO_FILE?: boolean;

  @IsOptional()
  @IsString()
  LOG_EXCLUDE_PATHS?: string;

  @IsOptional()
  @IsString()
  LOG_SENSITIVE_FIELDS?: string;

  // ==================== 文件上传配置 ====================

  @IsOptional()
  @IsBoolean()
  FILE_IS_LOCAL?: boolean;

  @IsOptional()
  @IsString()
  FILE_UPLOAD_LOCATION?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  FILE_MAX_SIZE?: number;

  @IsOptional()
  @IsString()
  FILE_DOMAIN?: string;

  @IsOptional()
  @IsString()
  FILE_SERVE_ROOT?: string;

  @IsOptional()
  @IsBoolean()
  FILE_THUMBNAIL_ENABLED?: boolean;

  // ==================== Redis 配置 ====================

  @IsOptional()
  @IsString()
  REDIS_HOST?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  REDIS_PORT?: number;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(15)
  REDIS_DB?: number;

  @IsOptional()
  @IsString()
  REDIS_KEY_PREFIX?: string;

  // ==================== HTTP 限流配置 ====================

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(86400000)
  GLOBAL_RATE_LIMIT_WINDOW_MS?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(1000000)
  GLOBAL_RATE_LIMIT_MAX?: number;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(86400000)
  THROTTLER_TTL_MS?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(1000000)
  THROTTLER_LIMIT?: number;

  // ==================== Prisma 连接池配置 ====================

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  PRISMA_CONNECTION_LIMIT?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(120)
  PRISMA_POOL_TIMEOUT_SECONDS?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(120)
  PRISMA_CONNECT_TIMEOUT_SECONDS?: number;

  // ==================== JWT 配置 ====================

  @IsOptional()
  @IsString()
  @MinLength(16)
  JWT_SECRET?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+[smhd]$/, {
    message: 'JWT_EXPIRES_IN must be a valid time string (e.g., 1h, 30m, 7d)',
  })
  JWT_EXPIRES_IN?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+[smhd]$/, {
    message: 'JWT_REFRESH_EXPIRES_IN must be a valid time string (e.g., 2h, 1d)',
  })
  JWT_REFRESH_EXPIRES_IN?: string;

  // ==================== 租户配置 ====================

  @IsOptional()
  @IsBoolean()
  TENANT_ENABLED?: boolean;

  @IsOptional()
  @IsString()
  TENANT_SUPER_ID?: string;

  @IsOptional()
  @IsString()
  TENANT_DEFAULT_ID?: string;

  // ==================== 加密配置 ====================

  @IsOptional()
  @IsBoolean()
  CRYPTO_ENABLED?: boolean;

  @IsOptional()
  @IsString()
  CRYPTO_RSA_PUBLIC_KEY?: string;

  @IsOptional()
  @IsString()
  CRYPTO_RSA_PRIVATE_KEY?: string;

  // ==================== COS 配置 ====================

  @IsOptional()
  @IsString()
  COS_SECRET_ID?: string;

  @IsOptional()
  @IsString()
  COS_SECRET_KEY?: string;

  @IsOptional()
  @IsString()
  COS_BUCKET?: string;

  @IsOptional()
  @IsString()
  COS_REGION?: string;

  @IsOptional()
  @IsString()
  COS_DOMAIN?: string;

  @IsOptional()
  @IsString()
  COS_LOCATION?: string;

  // ==================== 阿里云 OSS ====================

  @IsOptional()
  @IsString()
  OSS_ACCESS_KEY_ID?: string;

  @IsOptional()
  @IsString()
  OSS_ACCESS_KEY_SECRET?: string;

  @IsOptional()
  @IsString()
  OSS_REGION?: string;

  @IsOptional()
  @IsString()
  OSS_BUCKET?: string;

  @IsOptional()
  @IsString()
  OSS_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  OSS_PUBLIC_BASE_URL?: string;

  @IsOptional()
  @IsString()
  OSS_PREFIX?: string;

  // ==================== 权限配置 ====================

  @IsOptional()
  @IsString()
  PERM_WHITELIST?: string;

  // ==================== 代码生成配置 ====================

  @IsOptional()
  @IsString()
  GEN_AUTHOR?: string;

  @IsOptional()
  @IsString()
  GEN_PACKAGE_NAME?: string;

  @IsOptional()
  @IsString()
  GEN_MODULE_NAME?: string;

  @IsOptional()
  @IsBoolean()
  GEN_AUTO_REMOVE_PRE?: boolean;

  @IsOptional()
  @IsString()
  GEN_TABLE_PREFIX?: string;

  // ==================== 用户配置 ====================

  @IsOptional()
  @IsString()
  @MinLength(6)
  USER_INITIAL_PASSWORD?: string;

  // ==================== 客户端配置 ====================

  @IsOptional()
  @IsString()
  CLIENT_DEFAULT_ID?: string;

  @IsOptional()
  @IsIn(['password', 'authorization_code', 'client_credentials', 'refresh_token'])
  CLIENT_DEFAULT_GRANT_TYPE?: string;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(5000)
  CLIENT_PRODUCT_LIST_RATE_LIMIT?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(5000)
  CLIENT_PRODUCT_DETAIL_RATE_LIMIT?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(5000)
  CLIENT_PRODUCT_CATEGORY_RATE_LIMIT?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(50000)
  ADMIN_STORE_PRODUCT_LIST_RATE_LIMIT?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(10000)
  ADMIN_STORE_PRODUCT_IMPORT_EXCEL_RATE_LIMIT?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(10000)
  ADMIN_STORE_PRODUCT_IMPORT_BATCH_RATE_LIMIT?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(32)
  ADMIN_STORE_PRODUCT_IMPORT_WORKER_CONCURRENCY?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5000)
  ADMIN_STORE_PRODUCT_IMPORT_MAX_ROWS?: number;

  @IsOptional()
  @IsNumber()
  @Min(2048)
  @Max(50000000)
  ADMIN_STORE_PRODUCT_IMPORT_MAX_FILE_BASE64_CHARS?: number;

  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(200000)
  ADMIN_STORE_PRODUCT_IMPORT_QUEUE_BACKLOG_LIMIT?: number;

  @IsOptional()
  @IsBoolean()
  ADMIN_STORE_PRODUCT_LIST_RATE_LIMIT_FALLBACK_ENABLED?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(300000)
  ADMIN_STORE_PRODUCT_LIST_FALLBACK_TTL_MS?: number;

  @IsOptional()
  @IsBoolean()
  ADMIN_STORE_PRODUCT_LIST_QUERY_CACHE_ENABLED?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(3600)
  ADMIN_STORE_PRODUCT_LIST_QUERY_CACHE_TTL_SECONDS?: number;

  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(86400)
  ADMIN_STORE_PRODUCT_LIST_QUERY_STALE_TTL_SECONDS?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60000)
  ADMIN_STORE_PRODUCT_LIST_QUERY_L1_TTL_MS?: number;

  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(100000)
  ADMIN_STORE_PRODUCT_LIST_QUERY_L1_MAX_ENTRIES?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(10000)
  CLIENT_PRODUCT_LIST_INFLIGHT_LIMIT?: number;

  @IsOptional()
  @IsBoolean()
  CLIENT_PRODUCT_RATE_LIMIT_FALLBACK_ENABLED?: boolean;

  @IsOptional()
  @IsBoolean()
  CLIENT_PRODUCT_LIST_OVERLOAD_FALLBACK_ENABLED?: boolean;

  // ==================== 阿里云短信（可选） ====================

  @IsOptional()
  @IsString()
  ALIYUN_SMS_ACCESS_KEY_ID?: string;

  @IsOptional()
  @IsString()
  ALIYUN_SMS_ACCESS_KEY_SECRET?: string;

  @IsOptional()
  @IsString()
  ALIYUN_SMS_SIGN_NAME?: string;

  @IsOptional()
  @IsString()
  ALIYUN_SMS_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  ALIYUN_SMS_REGION_ID?: string;

  @IsOptional()
  @IsString()
  ALIYUN_SMS_TEST_PHONE?: string;

  @IsOptional()
  @IsString()
  ALIYUN_SMS_TEMPLATE_MEMBER_LOGIN?: string;

  @IsOptional()
  @IsString()
  ALIYUN_SMS_TEMPLATE_MEMBER_RESET?: string;

  @IsOptional()
  @IsString()
  ALIYUN_SMS_TEMPLATE_ADMIN_LOGIN?: string;

  @IsOptional()
  @IsString()
  ALIYUN_SMS_TEMPLATE_ADMIN_RESET?: string;

  @IsOptional()
  @IsString()
  ALIYUN_SMS_TEMPLATE_NOTIFICATION?: string;

  // ==================== 微信配置 ====================
  @IsOptional()
  @IsString()
  WX_APPID?: string;

  @IsOptional()
  @IsString()
  WX_SECRET?: string;

  /** 高德 Web 服务 Key（地理编码）；未配置时收货地址仍可保存但不自动补经纬度 */
  @IsOptional()
  @IsString()
  AMAP_WEB_SERVICE_KEY?: string;

  // ==================== 订单配置 ====================

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1440)
  ORDER_UNPAID_TIMEOUT_MINUTES?: number;

  @IsOptional()
  @IsString()
  ORDER_UNPAID_AUTO_CANCEL_REASON?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  ORDER_UNPAID_AUTO_CANCEL_SWEEP_BATCH_SIZE?: number;

  // ==================== 支付配置 ====================

  @IsOptional()
  @IsIn(['auto', 'wechat', 'mock'])
  PAYMENT_GATEWAY_MODE?: string;

  @IsOptional()
  @IsString()
  PAYMENT_ENABLE_MOCK_SUCCESS?: string;

  @IsOptional()
  @IsString()
  WECHAT_PAY_CALLBACK_VERIFY_SIGNATURE?: string;

  @IsOptional()
  @IsString()
  WECHAT_PAY_NOTIFY_URL?: string;

  @IsOptional()
  @IsString()
  WECHAT_PAY_REFUND_NOTIFY_URL?: string;
}

function parseBooleanEnv(raw: unknown): boolean | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

/**
 * 环境变量验证函数
 *
 * @description
 * 在应用启动时由 ConfigModule 调用
 * 验证失败会抛出异常并阻止应用启动
 *
 * @param config 原始环境变量对象
 * @returns 验证后的环境变量对象
 * @throws Error 如果验证失败
 */
export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((error) => `  - ${error.property}: ${Object.values(error.constraints || {}).join(', ')}`)
      .join('\n');

    throw new Error(`环境变量验证失败:\n${messages}\n\n请检查 .env.${process.env.NODE_ENV || 'development'} 文件`);
  }

  const nodeEnv = String(config.NODE_ENV ?? validatedConfig.NODE_ENV ?? '')
    .trim()
    .toLowerCase();
  const paymentGatewayMode = String(config.PAYMENT_GATEWAY_MODE ?? '')
    .trim()
    .toLowerCase();
  const mockSuccessEnabled = parseBooleanEnv(config.PAYMENT_ENABLE_MOCK_SUCCESS);
  const verifySignature = parseBooleanEnv(config.WECHAT_PAY_CALLBACK_VERIFY_SIGNATURE);
  const notifyUrl = String(config.WECHAT_PAY_NOTIFY_URL ?? '').trim();
  const refundNotifyUrl = String(config.WECHAT_PAY_REFUND_NOTIFY_URL ?? '').trim();

  if (nodeEnv === 'production') {
    if (paymentGatewayMode === 'mock') {
      throw new Error('生产环境禁止 PAYMENT_GATEWAY_MODE=mock，请改为 auto 或 wechat');
    }

    if (mockSuccessEnabled === true) {
      throw new Error('生产环境禁止 PAYMENT_ENABLE_MOCK_SUCCESS=true');
    }

    if (verifySignature === false) {
      throw new Error('生产环境禁止 WECHAT_PAY_CALLBACK_VERIFY_SIGNATURE=false');
    }

    if (notifyUrl.length > 0 && !notifyUrl.includes('/client/payment/notify')) {
      throw new Error('WECHAT_PAY_NOTIFY_URL 必须指向 /client/payment/notify 路径');
    }

    if (refundNotifyUrl.length > 0 && !refundNotifyUrl.includes('/client/payment/refund-notify')) {
      throw new Error('WECHAT_PAY_REFUND_NOTIFY_URL 必须指向 /client/payment/refund-notify 路径');
    }
  }

  return validatedConfig;
}

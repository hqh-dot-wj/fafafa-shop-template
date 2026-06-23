import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type { Request, Response } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { mw as requestIpMw } from 'request-ip';
import { Logger, ValidationPipe } from '@nestjs/common';
import { Result, ResponseCode } from 'src/common/response';
import { GlobalExceptionFilter } from 'src/common/filters/global-exception.filter';
import { ErrorEventService } from 'src/common/observability';
import { AppConfigService } from 'src/config/app-config.service';
import { ProductQueryFallbackService } from 'src/module/client/product/product-query-fallback.service';
import { isClientProductListPath } from 'src/module/client/product/product-query-cache.util';
import { StoreProductQueryFallbackService } from 'src/module/store/product/store-product-query-fallback.service';
import { isAdminStoreProductListPath } from 'src/module/store/product/store-product-query-fallback.util';
import { RedisService } from 'src/module/common/redis/redis.service';
import { RedisExpressRateLimitStore } from 'src/common/guards/redis-express-rate-limit.store';
import { buildRateLimitIdentityKey } from 'src/common/guards/rate-limit-key.util';
import { recordRateLimitEvent } from 'src/common/guards/rate-limit.metrics';
import { Logger as PinoLogger } from 'nestjs-pino';
import { ClsService } from 'nestjs-cls';
import path from 'path';
import {
  isOpenApiDevThrottleEnabled,
  isOpenApiForceRefreshEnv,
  readCachedOpenApiDocument,
  resolveOpenApiArtifactPaths,
  shouldRegenerateOpenApiDocument,
  writeOpenApiArtifacts,
} from './openapi-refresh.util';

// API 版本信息
export const API_INFO = {
  title: 'Nest-Admin-Soybean',
  description: `
## Nest-Admin-Soybean 后台管理系统 API 文档

### 接口说明
- 所有接口返回统一格式: \`{ code: number, msg: string, data: any }\`
- code=200 表示成功，其他表示失败
- 需要认证的接口请在请求头携带 \`Authorization: Bearer <token>\`

### 版本历史
- v2.0.0 (2024-01) - 重构优化，Enum 统一管理，DTO/VO 文件拆分
- v1.0.0 (2023-01) - 初始版本
  `,
  version: '2.0.0',
  contact: {
    name: 'Nest-Admin-Soybean',
    url: 'https://github.com/hqh-dot-wj/O2O-Mall-project',
  },
  license: {
    name: 'MIT',
    url: 'https://opensource.org/licenses/MIT',
  },
};

export interface AppBootstrapOptions {
  registerSwagger?: boolean;
  writeOpenApi?: boolean;
  registerRequestIp?: boolean;
  usePinoLogger?: boolean;
}

export interface AppBootstrapResult {
  prefix: string;
  port: number;
  openApiOnly: boolean;
  openApiPath?: string;
}

const parseRateLimitValue = (raw: string | undefined, fallback: number, min: number, max: number): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
};

const parseBooleanValue = (raw: string | undefined, fallback: boolean): boolean => {
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

export async function applyAppBootstrap(
  app: NestExpressApplication,
  options: AppBootstrapOptions = {},
): Promise<AppBootstrapResult> {
  const config = app.get(AppConfigService);
  const logger = new Logger('Bootstrap');
  const productQueryFallbackService = app.get(ProductQueryFallbackService);
  const storeProductQueryFallbackService = app.get(StoreProductQueryFallbackService);
  const redisService = app.get(RedisService);
  const globalRateLimitStore = new RedisExpressRateLimitStore(redisService, 'global-http');
  const clientProductListRateLimitStore = new RedisExpressRateLimitStore(redisService, 'client-product-list');
  const prefix = config.app.prefix;
  const registerSwagger = options.registerSwagger ?? true;
  const writeOpenApi = options.writeOpenApi ?? true;
  const registerRequestIp = options.registerRequestIp ?? true;

  if (options.usePinoLogger ?? true) {
    app.useLogger(app.get(PinoLogger));
    app.flushLogs();
  }

  // 信任代理（nginx 反向代理时需要，否则 express-rate-limit 会报错）。
  app.set('trust proxy', 1);

  const productRateLimitFallbackEnabled = parseBooleanValue(
    process.env.CLIENT_PRODUCT_RATE_LIMIT_FALLBACK_ENABLED,
    true,
  );

  const buildRateLimitHandler =
    (defaultMessage: string, scope: string) =>
    async (
      req: Request,
      res: Response,
      _next: unknown,
      handlerOptions: {
        statusCode: number;
        message: unknown;
      },
    ): Promise<void> => {
      const message = typeof handlerOptions.message === 'string' ? handlerOptions.message : defaultMessage;

      if (
        productRateLimitFallbackEnabled &&
        req.method.toUpperCase() === 'GET' &&
        isClientProductListPath(req.originalUrl)
      ) {
        try {
          const fallbackResult = await productQueryFallbackService.buildListFallbackResult({
            headers: req.headers as Record<string, unknown>,
            query: req.query as Record<string, unknown>,
          });
          if (fallbackResult) {
            res.setHeader('X-RateLimit-Fallback', 'stale-cache');
            recordRateLimitEvent('express', scope, 'fallback');
            res.status(200).json(fallbackResult);
            return;
          }
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          logger.warn(`限流兜底缓存读取失败，降级返回429: ${reason}`);
        }
      }

      if (
        req.method.toUpperCase() === 'POST' &&
        isAdminStoreProductListPath(req.originalUrl) &&
        storeProductQueryFallbackService
      ) {
        try {
          const fallbackResult = await storeProductQueryFallbackService.buildListFallbackResult({
            headers: req.headers as Record<string, unknown>,
            body: req.body as Record<string, unknown>,
            path: req.originalUrl,
          });
          if (fallbackResult) {
            res.setHeader('X-RateLimit-Fallback', 'stale-cache');
            recordRateLimitEvent('express', 'admin-store-product-list', 'fallback');
            res.status(200).json(fallbackResult);
            return;
          }
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          logger.warn(`后台商品查询限流兜底缓存读取失败，降级返回429: ${reason}`);
        }
      }

      recordRateLimitEvent('express', scope, 'reject');
      res.status(handlerOptions.statusCode).json(Result.fail(ResponseCode.TOO_MANY_REQUESTS, message));
    };

  const shouldSkipExpressRateLimit = (rawPath: string): boolean => {
    const requestPath = rawPath.split('?')[0] || '';
    return (
      requestPath.endsWith('/client/payment/notify') ||
      requestPath.endsWith('/client/payment/refund-notify') ||
      requestPath.endsWith('/metrics') ||
      requestPath.endsWith('/health')
    );
  };

  const globalRateLimitWindowMs = parseRateLimitValue(
    process.env.GLOBAL_RATE_LIMIT_WINDOW_MS,
    15 * 60 * 1000,
    1000,
    24 * 60 * 60 * 1000,
  );
  const globalRateLimitMax = parseRateLimitValue(process.env.GLOBAL_RATE_LIMIT_MAX, 5_000, 10, 1_000_000);

  app.use(
    rateLimit({
      windowMs: globalRateLimitWindowMs,
      max: globalRateLimitMax,
      message: '请求过于频繁,请稍后再试',
      handler: buildRateLimitHandler('请求过于频繁,请稍后再试', 'global-http'),
      store: globalRateLimitStore,
      keyGenerator: (req) => buildRateLimitIdentityKey(req as any, 'global-http'),
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        const requestPath = req.originalUrl || req.url || '';
        return shouldSkipExpressRateLimit(requestPath);
      },
    }),
  );

  const productListRateLimit = Number(process.env.CLIENT_PRODUCT_LIST_RATE_LIMIT ?? 300);
  if (Number.isFinite(productListRateLimit) && productListRateLimit > 0) {
    app.use(
      `${prefix}/client/product/list`,
      rateLimit({
        windowMs: 60 * 1000,
        max: Math.trunc(productListRateLimit),
        message: '商品查询过于频繁，请稍后再试',
        handler: buildRateLimitHandler('商品查询过于频繁，请稍后再试', 'client-product-list'),
        store: clientProductListRateLimitStore,
        keyGenerator: (req) => buildRateLimitIdentityKey(req as any, 'client-product-list'),
        standardHeaders: true,
        legacyHeaders: false,
      }),
    );
  }

  const rootPath = process.cwd();
  const baseDirPath = path.posix.join(rootPath, config.app.file.location);
  app.useStaticAssets(baseDirPath, {
    prefix: '/profile/',
    maxAge: 86400000 * 365,
  });

  app.useStaticAssets('public', {
    prefix: '/public/',
    maxAge: 0,
  });

  app.setGlobalPrefix(prefix);

  const server = app.getHttpAdapter().getInstance();
  server.get('/', (_req: any, res: any) => {
    res.json({
      name: API_INFO.title,
      version: API_INFO.version,
      docs: `${prefix}/swagger-ui`,
      health: `${prefix}/health`,
    });
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter(app.get(ClsService), app.get(ErrorEventService)));

  app.use(
    helmet({
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      crossOriginResourcePolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:', 'http:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'self'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use(cookieParser());

  const port = config.app.port || 8080;
  let openApiPath: string | undefined;

  if (registerSwagger || writeOpenApi) {
    const swaggerOptions = new DocumentBuilder()
      .setTitle(API_INFO.title)
      .setDescription(API_INFO.description)
      .setVersion(API_INFO.version)
      .setContact(API_INFO.contact.name, API_INFO.contact.url, '')
      .setLicense(API_INFO.license.name, API_INFO.license.url)
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          in: 'header',
          name: 'Authorization',
          description: '请在请求头中携带 JWT 令牌，格式：Bearer <token>',
        },
        'Authorization',
      )
      .addServer(config.app.file.domain)
      .build();

    const artifactPaths = resolveOpenApiArtifactPaths(process.cwd());
    openApiPath = artifactPaths.openApiPath;
    const forceRefresh = isOpenApiForceRefreshEnv();
    const throttleInDev = isOpenApiDevThrottleEnabled(process.env.NODE_ENV);
    const refreshDecision = shouldRegenerateOpenApiDocument({
      paths: artifactPaths,
      forceRefresh,
      throttleInDev,
    });

    let document: ReturnType<typeof SwaggerModule.createDocument>;
    if (refreshDecision.refresh) {
      document = SwaggerModule.createDocument(app, swaggerOptions);
      if (writeOpenApi) {
        writeOpenApiArtifacts(artifactPaths, document, refreshDecision.contractMaxMtimeMs);
        logger.log(`OpenAPI 已重新生成（${refreshDecision.reason}）: ${openApiPath}`);
      }
    } else {
      document = readCachedOpenApiDocument(openApiPath);
      logger.log(
        `OpenAPI 契约源未变更（${refreshDecision.reason}），跳过 SwaggerModule.createDocument，复用 ${openApiPath}`,
      );
    }

    if (process.env.OPENAPI_ONLY === 'true' && writeOpenApi) {
      return {
        prefix,
        port,
        openApiOnly: true,
        openApiPath,
      };
    }

    if (registerSwagger) {
      SwaggerModule.setup(`${prefix}/swagger-ui`, app, document, {
        swaggerOptions: {
          persistAuthorization: true,
        },
        customSiteTitle: 'Nest-Admin-Soybean API Docs',
      });
    }
  }

  if (registerRequestIp) {
    app.use(requestIpMw({ attributeName: 'ip' }));
  }

  return {
    prefix,
    port,
    openApiOnly: false,
    openApiPath,
  };
}

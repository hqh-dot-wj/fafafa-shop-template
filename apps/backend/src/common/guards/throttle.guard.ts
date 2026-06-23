import { Injectable, ExecutionContext, HttpException, HttpStatus, Inject, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { ProductQueryFallbackService } from 'src/module/client/product/product-query-fallback.service';
import { isClientProductListPath } from 'src/module/client/product/product-query-cache.util';
import { StoreProductQueryFallbackService } from 'src/module/store/product/store-product-query-fallback.service';
import { isAdminStoreProductListPath } from 'src/module/store/product/store-product-query-fallback.util';
import { buildRateLimitIdentityKey } from './rate-limit-key.util';
import { recordRateLimitEvent } from './rate-limit.metrics';

/** 限流器可识别的请求结构 */
interface ThrottleRequestLike {
  user?: { userId?: string };
  method?: string;
  url?: string;
  originalUrl?: string;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  ip?: string;
  headers?: Record<string, unknown>;
  socket?: { remoteAddress?: string };
}

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(CustomThrottlerGuard.name);
  private static readonly SKIP_PATH_SUFFIXES = ['/metrics', '/health'];

  @Inject(ProductQueryFallbackService)
  private readonly productQueryFallbackService!: ProductQueryFallbackService;
  @Inject(StoreProductQueryFallbackService)
  private readonly storeProductQueryFallbackService!: StoreProductQueryFallbackService;

  private extractPath(req: ThrottleRequestLike): string {
    return (req.originalUrl || req.url || '').split('?')[0] || '';
  }

  private shouldSkipThrottle(req: ThrottleRequestLike): boolean {
    const path = this.extractPath(req);
    return CustomThrottlerGuard.SKIP_PATH_SUFFIXES.some((suffix) => path.endsWith(suffix));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ThrottleRequestLike>();
    if (this.shouldSkipThrottle(req)) {
      return true;
    }
    return await super.canActivate(context);
  }

  protected async getTracker(req: ThrottleRequestLike): Promise<string> {
    return buildRateLimitIdentityKey(req, 'throttler');
  }

  // ThrottlerGuard in newer versions expects an async method with this signature
  protected async throwThrottlingException(context: ExecutionContext, _throttlerLimitDetail?: unknown): Promise<void> {
    const http = context.switchToHttp();
    const req = http.getRequest<ThrottleRequestLike>();
    const res = http.getResponse<{ setHeader: (name: string, value: string) => void }>();
    const method = (req.method || '').toUpperCase();
    const path = this.extractPath(req);
    const isProductListQuery = method === 'GET' && isClientProductListPath(path);
    const isAdminStoreProductListQuery = method === 'POST' && isAdminStoreProductListPath(path);
    const scope = isProductListQuery
      ? 'client-product-list'
      : isAdminStoreProductListQuery
        ? 'admin-store-product-list'
        : 'throttler-default';

    if (isProductListQuery && this.productQueryFallbackService) {
      try {
        const fallback = await this.productQueryFallbackService.buildListFallbackResult({
          headers: req.headers,
          query: req.query,
        });
        if (fallback) {
          res.setHeader('X-RateLimit-Fallback', 'stale-cache');
          recordRateLimitEvent('throttler', scope, 'fallback');
          throw new HttpException(fallback, HttpStatus.OK);
        }
      } catch (error) {
        if (error instanceof HttpException && error.getStatus() === HttpStatus.OK) {
          throw error;
        }
        // fallback 查找失败时继续走标准限流响应，不影响主流程稳定性
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`限流兜底失败，降级返回429: ${message}`);
      }
    }

    if (isAdminStoreProductListQuery && this.storeProductQueryFallbackService) {
      try {
        const fallback = await this.storeProductQueryFallbackService.buildListFallbackResult({
          headers: req.headers,
          body: req.body,
          path,
        });
        if (fallback) {
          res.setHeader('X-RateLimit-Fallback', 'stale-cache');
          recordRateLimitEvent('throttler', scope, 'fallback');
          throw new HttpException(fallback, HttpStatus.OK);
        }
      } catch (error) {
        if (error instanceof HttpException && error.getStatus() === HttpStatus.OK) {
          throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`后台商品查询限流兜底失败，降级返回429: ${message}`);
      }
    }

    recordRateLimitEvent('throttler', scope, 'reject');
    throw new ThrottlerException('请求过于频繁，请稍后再试');
  }
}

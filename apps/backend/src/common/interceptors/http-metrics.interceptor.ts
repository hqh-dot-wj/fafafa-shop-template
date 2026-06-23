import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Request, Response } from 'express';
import { Counter, Histogram } from 'prom-client';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

type HttpMetricLabel = 'method' | 'path' | 'status';

const UUID_SEGMENT_REGEXP = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OBJECT_ID_SEGMENT_REGEXP = /^[0-9a-f]{24}$/i;
const LONG_HEX_SEGMENT_REGEXP = /^[0-9a-f]{16,}$/i;
const TOKEN_SEGMENT_REGEXP = /^[A-Za-z0-9_-]{24,}$/;
const NUMBER_SEGMENT_REGEXP = /^\d+$/;

const METRIC_SKIP_PATH_PREFIXES = ['/api/metrics', '/api/health', '/api/swagger-ui', '/swagger-ui', '/public/', '/profile/'];

function normalizeLeadingSlash(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '/unknown';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function sanitizePathSegment(segment: string): string {
  const trimmed = segment.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith(':')) return trimmed.toLowerCase();
  if (NUMBER_SEGMENT_REGEXP.test(trimmed)) return ':int';
  if (UUID_SEGMENT_REGEXP.test(trimmed)) return ':uuid';
  if (OBJECT_ID_SEGMENT_REGEXP.test(trimmed)) return ':oid';
  if (LONG_HEX_SEGMENT_REGEXP.test(trimmed)) return ':hex';
  if (TOKEN_SEGMENT_REGEXP.test(trimmed)) return ':token';
  if (trimmed.length > 64) return ':slug';
  return trimmed;
}

function normalizeRawPath(rawPath: string): string {
  const noQueryPath = rawPath.split('?')[0] ?? rawPath;
  const withLeadingSlash = normalizeLeadingSlash(noQueryPath);
  const normalized = withLeadingSlash
    .split('/')
    .map((segment) => sanitizePathSegment(segment))
    .join('/')
    .replace(/\/{2,}/g, '/');
  return normalized || '/unknown';
}

export function normalizeHttpMetricPath(req: Pick<Request, 'route' | 'baseUrl' | 'path' | 'originalUrl' | 'url'>): string {
  const routePath = typeof req.route?.path === 'string' ? req.route.path : undefined;
  const baseUrl = typeof req.baseUrl === 'string' ? req.baseUrl : '';
  const pathFromRoute = routePath ? `${baseUrl}${routePath}` : undefined;
  const pathFromRequest =
    pathFromRoute ||
    (typeof req.path === 'string' ? req.path : undefined) ||
    (typeof req.originalUrl === 'string' ? req.originalUrl : undefined) ||
    (typeof req.url === 'string' ? req.url : undefined) ||
    '/unknown';
  return normalizeRawPath(pathFromRequest);
}

export function shouldSkipHttpMetric(path: string): boolean {
  return METRIC_SKIP_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric('http_requests_total')
    private readonly requestCounter: Counter<HttpMetricLabel>,
    @InjectMetric('http_request_duration_seconds')
    private readonly requestDuration: Histogram<HttpMetricLabel>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest<Request>();
    const res = httpContext.getResponse<Response>();

    const method = (req.method || 'UNKNOWN').toUpperCase();
    const path = normalizeHttpMetricPath(req);
    if (shouldSkipHttpMetric(path)) {
      return next.handle();
    }

    const startedAt = process.hrtime.bigint();

    return next.handle().pipe(
      finalize(() => {
        const elapsedNanoseconds = process.hrtime.bigint() - startedAt;
        const durationSeconds = Number(elapsedNanoseconds) / 1_000_000_000;
        const status = String(res.statusCode || 500);
        const labels: Record<HttpMetricLabel, string> = {
          method,
          path,
          status,
        };

        this.requestCounter.inc(labels);
        this.requestDuration.observe(labels, durationSeconds);
      }),
    );
  }
}

import * as crypto from 'crypto';
import { TenantContext } from 'src/common/tenant/tenant.context';

interface RateLimitUserLike {
  userId?: unknown;
}

export interface RateLimitIdentityInput {
  user?: RateLimitUserLike;
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
  ip?: string;
  socket?: { remoteAddress?: string };
}

function readHeaderValue(headers: Record<string, unknown> | undefined, headerName: string): string | undefined {
  if (!headers) return undefined;
  const target = headerName.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== target) continue;
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    return undefined;
  }
  return undefined;
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  return undefined;
}

function parseForwardedFor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const first = value.split(',')[0]?.trim();
  return first && first.length > 0 ? first : undefined;
}

function extractBearerToken(headers: Record<string, unknown> | undefined): string | undefined {
  const authorization = readHeaderValue(headers, 'authorization');
  if (!authorization) return undefined;
  const trimmed = authorization.trim();
  if (trimmed.length === 0) return undefined;

  const match = /^Bearer\s+(.+)$/i.exec(trimmed);
  const token = (match?.[1] ?? trimmed).trim();
  if (token.length < 16) return undefined;
  return token;
}

export function resolveRateLimitTenantId(input: RateLimitIdentityInput): string {
  const tenantFromHeader = normalizeText(readHeaderValue(input.headers, 'tenant-id'));
  if (tenantFromHeader) return tenantFromHeader;

  const tenantFromQuery = normalizeText(input.query?.tenantId);
  if (tenantFromQuery) return tenantFromQuery;

  return TenantContext.SUPER_TENANT_ID;
}

export function resolveRateLimitIp(input: RateLimitIdentityInput): string {
  const forwardedFor = parseForwardedFor(normalizeText(readHeaderValue(input.headers, 'x-forwarded-for')));
  if (forwardedFor) return forwardedFor;

  const xRealIp = normalizeText(readHeaderValue(input.headers, 'x-real-ip'));
  if (xRealIp) return xRealIp;

  const directIp = normalizeText(input.ip);
  if (directIp) return directIp;

  const socketIp = normalizeText(input.socket?.remoteAddress);
  if (socketIp) return socketIp;

  return 'unknown';
}

export function buildRateLimitIdentityKey(input: RateLimitIdentityInput, scope = 'http'): string {
  const tenantId = resolveRateLimitTenantId(input);
  const userId = normalizeText(input.user?.userId);
  if (userId) {
    return `${scope}:tenant:${tenantId}:user:${userId}`;
  }

  const token = extractBearerToken(input.headers);
  if (token) {
    const digest = crypto.createHash('md5').update(token).digest('hex').slice(0, 16);
    return `${scope}:tenant:${tenantId}:token:${digest}`;
  }

  const ip = resolveRateLimitIp(input);
  return `${scope}:tenant:${tenantId}:ip:${ip}`;
}
